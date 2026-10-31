import { Select, type SelectProps } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { customersApi } from '@/lib/api/endpoints'

interface Props extends Omit<SelectProps, 'data' | 'value' | 'onChange' | 'searchValue' | 'onSearchChange'> {
  value: string | undefined
  onChange: (id: string | undefined) => void
}

/** Searchable customer picker that searches on the server, and shows the name of a customer chosen from the URL. */
export function CustomerSelect({ value, onChange, ...rest }: Props) {
  const [search, setSearch] = useState('')
  const [debounced] = useDebouncedValue(search.trim(), 250)
  const list = useQuery({
    queryKey: ['customers', 'options', debounced],
    queryFn: () => customersApi.list({ search: debounced || undefined, limit: 30, sort: 'name' }),
    placeholderData: keepPreviousData,
  })
  const inList = list.data?.data.some((c) => c.id === value)
  const selected = useQuery({
    queryKey: ['customers', 'detail', value],
    queryFn: () => customersApi.get(value!),
    enabled: Boolean(value) && list.isSuccess && !inList,
  })
  const options = (list.data?.data ?? []).map((c) => ({ value: c.id, label: c.name }))
  if (value && !inList && selected.data) options.unshift({ value: selected.data.id, label: selected.data.name })

  return (
    <Select
      searchable
      clearable
      placeholder="Any customer"
      nothingFoundMessage={list.isFetching ? 'Searching…' : 'No customer by that name'}
      filter={({ options }) => options}
      data={options}
      value={value ?? null}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(v) => onChange(v ?? undefined)}
      {...rest}
    />
  )
}
