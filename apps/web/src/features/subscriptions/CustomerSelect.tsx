import { Loader, Select, type SelectProps } from '@mantine/core'
import { useState } from 'react'
import type { Ref } from '@/lib/api/types'
import { useCustomerSearch } from './queries'

interface Props extends Omit<SelectProps, 'data' | 'value' | 'onChange' | 'searchValue' | 'onSearchChange'> {
  value: Ref | null
  onChange: (customer: Ref | null) => void
}

/** Searchable customer picker; the API does the searching, so it scales past one page of customers. */
export function CustomerSelect({ value, onChange, ...rest }: Props) {
  const [search, setSearch] = useState(value?.name ?? '')
  // While the box shows the chosen name, list everyone rather than just that one match.
  const term = value && search === value.name ? '' : search
  const { options, isFetching } = useCustomerSearch(term, value)

  return (
    <Select
      searchable
      data={options}
      value={value?.id ?? null}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(id, option) => onChange(id && option ? { id, name: option.label } : null)}
      filter={({ options: all }) => all}
      selectFirstOptionOnChange
      nothingFoundMessage={isFetching ? 'Searching…' : 'No customer with that name'}
      rightSection={isFetching ? <Loader size={14} /> : undefined}
      placeholder="Search customers"
      {...rest}
    />
  )
}
