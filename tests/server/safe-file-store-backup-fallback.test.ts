import { afterEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'

const {
  mockCopyFile,
  mockMkdir,
  mockReadFile,
  mockRename,
  mockRm,
  mockWriteFile,
} = vi.hoisted(() => ({
  mockCopyFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockRename: vi.fn(),
  mockRm: vi.fn(),
  mockWriteFile: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  copyFile: mockCopyFile,
  mkdir: mockMkdir,
  readFile: mockReadFile,
  rename: mockRename,
  rm: mockRm,
  writeFile: mockWriteFile,
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('SafeFileStore backup fallback', () => {
  it('uses a timestamped backup when the default backup cannot be overwritten', async () => {
    mockCopyFile
      .mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 'EACCES' }))
      .mockResolvedValueOnce(undefined)
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)

    const { SafeFileStore } = await import('../../packages/server/src/services/safe-file-store')
    const store = new SafeFileStore()
    const configPath = join(tmpdir(), 'config.yaml')

    await store.writeText(configPath, 'model:\n  default: new\n', { backup: true })

    expect(mockCopyFile).toHaveBeenCalledTimes(2)
    expect(mockCopyFile).toHaveBeenNthCalledWith(1, configPath, `${configPath}.bak`)
    expect(mockCopyFile.mock.calls[1][0]).toBe(configPath)
    expect(mockCopyFile.mock.calls[1][1]).toMatch(new RegExp(`^${configPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.bak\\.\\d+\\.`))
    expect(mockWriteFile).toHaveBeenCalledWith(expect.stringContaining(`${configPath}.tmp.`), 'model:\n  default: new\n', 'utf-8')
    expect(mockRename).toHaveBeenCalledWith(expect.stringContaining(`${configPath}.tmp.`), configPath)
  })

  it('preserves explicit backup path failures', async () => {
    mockCopyFile.mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 'EACCES' }))
    mockMkdir.mockResolvedValue(undefined)

    const { SafeFileStore } = await import('../../packages/server/src/services/safe-file-store')
    const store = new SafeFileStore()

    await expect(store.writeText(join(tmpdir(), 'config.yaml'), 'new', { backup: true, backupPath: join(tmpdir(), 'custom.bak') })).rejects.toThrow('permission denied')
    expect(mockCopyFile).toHaveBeenCalledTimes(1)
    expect(mockWriteFile).not.toHaveBeenCalled()
  })
})
