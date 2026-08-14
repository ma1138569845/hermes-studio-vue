// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProfileAvatar from '../../packages/client/src/components/hermes/profiles/ProfileAvatar.vue'

describe('ProfileAvatar component', () => {
  it('renders the business initial avatar when no custom avatar is set', () => {
    const wrapper = mount(ProfileAvatar, {
      props: { name: 'alice' },
    })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.find('linearGradient').exists()).toBe(true)
    expect(svg.find('circle').exists()).toBe(true)
    expect(svg.find('text').text()).toBe('A')
  })

  it('renders a stored image avatar as-is', () => {
    const wrapper = mount(ProfileAvatar, {
      props: {
        name: 'alice',
        avatar: { type: 'image', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
      },
    })
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,iVBORw0KGgo=')
  })

  it('falls back to the business avatar for a legacy cartoon SVG data URL', () => {
    const legacySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 231 231"><path d="M0,0"/></svg>'
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(legacySvg)))
    const wrapper = mount(ProfileAvatar, {
      props: {
        name: 'alice',
        avatar: { type: 'image', dataUrl },
      },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.find('text').text()).toBe('A')
  })
})
