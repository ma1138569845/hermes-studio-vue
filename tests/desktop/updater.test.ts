import { readFileSync } from 'node:fs'

// Normalize line endings so multi-line assertions hold on Windows checkouts.
function readSource(path: string): string {
  return readFileSync(path, 'utf-8').replace(/\r\n/g, '\n')
}
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isWindowsUpdaterLockError, pendingUpdateDirectories } from '../../packages/desktop/src/main/updater-helpers'

describe('desktop updater helpers', () => {
  it('detects Squirrel locked-exe update failures', async () => {
    expect(isWindowsUpdaterLockError(new Error('Failed to uninstall old application files. Please try running the installer again.: 2'))).toBe(true)
    expect(isWindowsUpdaterLockError(new Error('Squirrel update failed with code 2'))).toBe(true)
    expect(isWindowsUpdaterLockError(new Error('network timeout'))).toBe(false)
  })

  it('includes local and roaming pending update cache directories', async () => {
    expect(pendingUpdateDirectories({
      appDataPath: 'C:\\Users\\A\\AppData\\Roaming',
      localAppData: 'C:\\Users\\A\\AppData\\Local',
      appName: 'DechnicAuditor',
    })).toEqual(expect.arrayContaining([
      join('C:\\Users\\A\\AppData\\Local', 'DechnicAuditor-updater', 'pending'),
      join('C:\\Users\\A\\AppData\\Local', 'hermes-studio-updater', 'pending'),
      join('C:\\Users\\A\\AppData\\Roaming', 'hermes-studio-updater', 'pending'),
    ]))
  })

  it('checks on startup and from the tray without forcing an update', () => {
    const updaterSource = readSource(resolve('packages/desktop/src/main/updater.ts'))
    const mainSource = readSource(resolve('packages/desktop/src/main/index.ts'))

    expect(mainSource).toContain('checkForDesktopUpdates(true)')
    expect(updaterSource).toContain('checkForDesktopUpdates(false)')
    expect(updaterSource).toContain('autoUpdater.autoDownload = false')
    expect(updaterSource).toContain('autoUpdater.autoInstallOnAppQuit = true')
    expect(updaterSource).toContain("buttons: [t('update.download'), t('update.later')]")
    expect(updaterSource).toContain('if (response === 0) {\n    await autoUpdater.downloadUpdate()')
    expect(updaterSource).not.toContain('setInterval(')
  })

  it('gracefully stops the current app before starting a downloaded update', () => {
    const updaterSource = readSource(resolve('packages/desktop/src/main/updater.ts'))
    const mainSource = readSource(resolve('packages/desktop/src/main/index.ts'))

    expect(mainSource).toContain('async function prepareAppShutdown(): Promise<void>')
    expect(mainSource).toContain('await stopWebUiServer().catch(() => undefined)')
    expect(mainSource).toContain('initAutoUpdater({ beforeQuitAndInstall: prepareAppShutdown })')
    expect(mainSource).toContain('try {\n      await prepareAppShutdown()\n    } finally {\n      app.exit(0)')

    const prepareCurrentInstance = updaterSource.indexOf('await options.beforeQuitAndInstall?.()')
    const stopOtherInstances = updaterSource.indexOf('await stopOtherWindowsAppInstances()', prepareCurrentInstance)
    const startInstaller = updaterSource.indexOf('autoUpdater.quitAndInstall()', stopOtherInstances)
    expect(prepareCurrentInstance).toBeGreaterThan(-1)
    expect(stopOtherInstances).toBeGreaterThan(prepareCurrentInstance)
    expect(startInstaller).toBeGreaterThan(stopOtherInstances)
  })
})
