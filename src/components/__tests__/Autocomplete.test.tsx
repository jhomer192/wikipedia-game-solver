import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useState } from 'react'
import { Autocomplete } from '../Autocomplete'
import { opensearch } from '../../lib/wiki'

vi.mock('../../lib/wiki', () => ({
  opensearch: vi.fn(),
}))

const openMock = opensearch as unknown as ReturnType<typeof vi.fn>

function Harness({ initial = '' }: { initial?: string }) {
  const [val, setVal] = useState(initial)
  return (
    <Autocomplete
      id="test"
      label="Start"
      placeholder="Start article"
      value={val}
      onChange={setVal}
    />
  )
}


describe('Autocomplete', () => {
  beforeEach(() => openMock.mockReset())
  afterEach(() => openMock.mockReset())

  it('opens the dropdown when the user types 2+ chars', async () => {
    openMock.mockResolvedValue([
      { title: 'Dog', url: 'u1' },
      { title: 'Doggerel', url: 'u2' },
    ])
    render(<Harness />)
    const input = screen.getByLabelText('Start') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Do' } })

    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    expect(screen.getByRole('option', { name: /Dog$/ })).toBeInTheDocument()
  })

  describe('closes the dropdown on selection and does NOT reopen on the next debounce tick', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('fake-timer variant', async () => {
      openMock.mockResolvedValue([
        { title: 'Donovan Mitchell', url: 'u1' },
        { title: 'Donovan McNabb', url: 'u2' },
      ])
      render(<Harness />)
      const input = screen.getByLabelText('Start') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'Dono' } })

      // Advance past the 220ms debounce; wrap in act so React flushes state
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250)
      })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      openMock.mockClear()

      fireEvent.click(screen.getByRole('option', { name: /Donovan Mitchell$/ }))
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(350)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(openMock).not.toHaveBeenCalled()
    })
  })

  it('reopens the dropdown when the user types again after selecting', async () => {
    openMock.mockResolvedValue([
      { title: 'Donovan Mitchell', url: 'u1' },
      { title: 'Donovan McNabb', url: 'u2' },
    ])
    render(<Harness />)
    const input = screen.getByLabelText('Start') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Dono' } })
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('option', { name: /Donovan Mitchell$/ }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    openMock.mockResolvedValue([{ title: 'Apple', url: 'u1' }])
    fireEvent.change(input, { target: { value: 'Donovan MitchellApple' } })
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())
    expect(openMock).toHaveBeenCalled()
  })

  it('closes the dropdown when Escape is pressed', async () => {
    openMock.mockResolvedValue([{ title: 'Dog', url: 'u1' }])
    render(<Harness />)
    const input = screen.getByLabelText('Start') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Do' } })
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument())

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
