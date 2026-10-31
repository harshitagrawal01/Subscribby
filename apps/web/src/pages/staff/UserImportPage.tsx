import { Alert, Anchor, Button, Group, Stack, Table, Text, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconCheck, IconDownload, IconFileTypeCsv, IconUpload } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { StatusText } from '@/components/StatusBadge'
import { staffPath } from '@/features/auth/staff-base'
import classes from '@/features/people/UserImport.module.css'
import { isApiError } from '@/lib/api/client'
import { usersApi } from '@/lib/api/endpoints'
import type { ImportResult, ImportRow } from '@/lib/api/types'
import { pluralize } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'
import { notifyDone, notifyError } from '@/lib/notify'
import { tokens } from '@/theme'

const MAX_BYTES = 1024 * 1024

const COLUMNS: [string, string][] = [
  ['name', 'Full name, 2 to 80 characters'],
  ['email', 'Work email. Not already used by an account, and not repeated in the file'],
  ['temporary_password', 'More than 8 characters with an uppercase letter, a lowercase letter and a special character'],
  ['access_level', 'Internal Staff, Finance Lead or Admin'],
]

const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`)

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ['Choose a file', 'Check every row', 'Create the users']
  return (
    <ol className={classes.steps} aria-label="Import steps">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3
        return (
          <li key={label} data-current={n === current || undefined} data-done={n < current || undefined} aria-current={n === current ? 'step' : undefined}>
            <span className={classes.n}>{n < current ? <IconCheck size={12} stroke={2} /> : n}</span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

/** One cell's errors, in red under the value. */
function CellErrors({ row, field }: { row: ImportRow; field: string }) {
  const errors = row.errors.filter((e) => e.field === field)
  return (
    <>
      {errors.map((e) => (
        <span key={e.message} className={classes.cellError}>
          {e.message}
        </span>
      ))}
    </>
  )
}

function RowsTable({ rows, showPassword = true }: { rows: ImportRow[]; showPassword?: boolean }) {
  // Rows that need fixing first, then file order.
  const sorted = [...rows].sort((a, b) => Number(b.status === 'invalid') - Number(a.status === 'invalid') || a.row - b.row)
  return (
    <Table.ScrollContainer minWidth={860}>
      <Table className="data-table" verticalSpacing={9}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={64}>Row</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            {showPassword && <Table.Th>Password</Table.Th>}
            <Table.Th>Access level</Table.Th>
            <Table.Th w={140}>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((row) => (
            <Table.Tr key={row.row} className={row.status === 'invalid' ? classes.invalidRow : undefined} style={{ verticalAlign: 'top' }}>
              <Table.Td className="num" c="dimmed">
                {row.row}
              </Table.Td>
              <Table.Td>
                {row.name || <Text span c="dimmed">—</Text>}
                <CellErrors row={row} field="name" />
              </Table.Td>
              <Table.Td>
                {row.email || <Text span c="dimmed">—</Text>}
                <CellErrors row={row} field="email" />
              </Table.Td>
              {showPassword && (
                <Table.Td>
                  <Text span c="dimmed" size="sm">
                    {row.errors.some((e) => e.field === 'temporary_password') ? '' : 'Meets the rule'}
                  </Text>
                  <CellErrors row={row} field="temporary_password" />
                </Table.Td>
              )}
              <Table.Td>
                {row.role ? ROLE_LABELS[row.role] : <Text span c="dimmed">—</Text>}
                <CellErrors row={row} field="access_level" />
              </Table.Td>
              <Table.Td>
                {row.status === 'invalid' ? (
                  <StatusText label="Needs fixing" color={tokens.status.bad} />
                ) : row.status === 'created' ? (
                  <StatusText label="Created" color={tokens.status.good} />
                ) : (
                  <StatusText label="Ready" color={tokens.status.good} />
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

export function UserImportPage() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [created, setCreated] = useState<ImportResult | null>(null)
  const [fileError, setFileError] = useState<{ message: string; details: string[] } | null>(null)
  const [dragging, setDragging] = useState(false)

  const check = useMutation({
    mutationFn: (f: File) => usersApi.importCsv(f, true),
    onSuccess: (result) => setPreview(result),
    onError: (error) => {
      setFile(null)
      setFileError({
        message: isApiError(error) ? error.message : "The file couldn't be checked. Try again.",
        // Skip details the message already says (e.g. "Missing columns: name, email").
        details: isApiError(error)
          ? error.details.filter((d) => !error.message.includes(d.field)).map((d) => `${d.field}: ${d.message}`)
          : [],
      })
    },
  })

  const create = useMutation({
    mutationFn: (f: File) => usersApi.importCsv(f, false),
    onSuccess: (result) => {
      if (result.created > 0) {
        setCreated(result)
        queryClient.invalidateQueries({ queryKey: ['users'] })
        notifyDone(`${pluralize(result.created, 'user')} created`)
      } else {
        // Something changed since the preview (an email got taken, say). Nothing was created.
        setPreview(result)
        notifyError(null, 'Nothing was created. Some rows are no longer valid; fix them and choose the file again.')
      }
    },
    onError: (error) => notifyError(error, 'Nothing was created. Try again.'),
  })

  const template = useMutation({
    mutationFn: () => usersApi.importTemplate(),
    onSuccess: (csv) => {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'subscribby-users-template.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    },
    onError: (error) => notifyError(error, "The template didn't download. Try again."),
  })

  const choose = (f: File | undefined | null) => {
    if (!f) return
    setFileError(null)
    setPreview(null)
    if (!/\.csv$/i.test(f.name)) {
      setFileError({ message: `${f.name} isn't a CSV file. In your spreadsheet app, use Save as or Download, then choose CSV.`, details: [] })
      return
    }
    if (f.size > MAX_BYTES) {
      setFileError({ message: `${f.name} is ${formatSize(f.size)}. The limit is 1 MB (about 200 people); split it into smaller files.`, details: [] })
      return
    }
    if (f.size === 0) {
      setFileError({ message: `${f.name} is empty.`, details: [] })
      return
    }
    setFile(f)
    check.mutate(f)
  }

  const startOver = () => {
    setFile(null)
    setPreview(null)
    setCreated(null)
    setFileError(null)
    check.reset()
    create.reset()
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files?.[0])
  }

  const step: 1 | 2 | 3 = created ? 3 : preview ? 2 : 1
  const allValid = preview ? preview.invalid === 0 && preview.total > 0 : false

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,text/csv"
      hidden
      onChange={(e) => {
        choose(e.currentTarget.files?.[0])
        e.currentTarget.value = ''
      }}
    />
  )

  return (
    <>
      <Anchor component={Link} to={staffPath('/users')} size="sm" c="dimmed" mb={10} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <IconArrowLeft size={14} stroke={1.5} /> Users
      </Anchor>
      <PageHeader
        title="Import users from CSV"
        description="Create many staff accounts at once. Every row is checked first, and nobody is created unless every row is ready."
      />
      <Steps current={step} />
      {hiddenInput}

      {step === 1 && (
        <div className="panel">
          <div className={classes.layout}>
            <Stack gap="md">
              <div>
                <Title order={2} fz={16}>
                  What the file needs
                </Title>
                <Text size="sm" c="dimmed" mt={4}>
                  One person per row, with this header row. Column names aren't case-sensitive. Up to 200 people per file.
                </Text>
              </div>
              <table className={classes.columns}>
                <tbody>
                  {COLUMNS.map(([name, rule]) => (
                    <tr key={name}>
                      <td>
                        <span className="mono">{name}</span>
                      </td>
                      <td>
                        <Text size="sm" c="dimmed">
                          {rule}
                        </Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Group>
                <Button
                  variant="default"
                  leftSection={<IconDownload size={16} stroke={1.5} />}
                  onClick={() => template.mutate()}
                  loading={template.isPending}
                >
                  Download template
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                Everyone imported gets a temporary password and chooses their own at first login. Share each password with the person directly;
                Subscribby doesn't email them.
              </Text>
            </Stack>

            <Stack gap="sm">
              <div
                className={classes.drop}
                data-active={dragging || undefined}
                data-busy={check.isPending || undefined}
                role="button"
                tabIndex={0}
                aria-label="Choose a CSV file"
                onClick={() => !check.isPending && inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    inputRef.current?.click()
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <IconFileTypeCsv size={30} stroke={1.25} color={tokens.muted} />
                <Text fw={500}>{check.isPending ? `Checking ${file?.name ?? 'file'}…` : 'Drop your CSV file here'}</Text>
                <Text size="sm" c="dimmed">
                  or
                </Text>
                <Button
                  leftSection={<IconUpload size={16} stroke={1.5} />}
                  loading={check.isPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    inputRef.current?.click()
                  }}
                >
                  Choose file
                </Button>
                <Text size="xs" c="dimmed" mt={4}>
                  .csv only, up to 1 MB
                </Text>
              </div>
              {fileError && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="This file can't be imported">
                  <Text size="sm">{fileError.message}</Text>
                  {fileError.details.length > 0 && (
                    <Text size="sm" mt={4}>
                      {fileError.details.join(' · ')}
                    </Text>
                  )}
                  <Text size="sm" mt={4}>
                    Fix the file and choose it again, or start from the template.
                  </Text>
                </Alert>
              )}
            </Stack>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="panel">
          <Group justify="space-between" px={20} py={14} style={{ borderBottom: `1px solid ${tokens.line}` }} wrap="wrap">
            <Group gap={10} wrap="nowrap">
              <IconFileTypeCsv size={20} stroke={1.5} color={tokens.muted} />
              <div>
                <Text size="sm" fw={500}>
                  {file?.name}
                </Text>
                <Text size="sm" c="dimmed">
                  <span className="num">{pluralize(preview.total, 'row')}</span>
                  {' · '}
                  <Text span c={tokens.status.good} className="num">
                    {preview.valid} ready
                  </Text>
                  {preview.invalid > 0 && (
                    <>
                      {' · '}
                      <Text span c={tokens.status.bad} fw={500} className="num">
                        {preview.invalid} {preview.invalid === 1 ? 'needs' : 'need'} fixing
                      </Text>
                    </>
                  )}
                </Text>
              </div>
            </Group>
            <Button variant="subtle" onClick={() => inputRef.current?.click()} loading={check.isPending}>
              Choose another file
            </Button>
          </Group>

          <RowsTable rows={preview.rows} />

          <Group justify="space-between" px={20} py={16} style={{ borderTop: `1px solid ${tokens.line}` }} wrap="wrap" gap="md">
            <Text size="sm" c={allValid ? 'dimmed' : tokens.status.bad} maw={560}>
              {allValid
                ? `Every row is ready. Each person gets a temporary password and must change it at first login.`
                : `Nothing is created until every row is ready, so no one is half imported. Fix the ${pluralize(preview.invalid, 'row')} marked in red in your spreadsheet, save it as CSV and choose it again.`}
            </Text>
            <Group gap={8}>
              <Button variant="default" onClick={startOver}>
                Start over
              </Button>
              <Button disabled={!allValid} loading={create.isPending} onClick={() => file && create.mutate(file)}>
                Create {pluralize(preview.total, 'user')}
              </Button>
            </Group>
          </Group>
        </div>
      )}

      {step === 3 && created && (
        <div className="panel">
          <div style={{ padding: '22px 20px 16px', borderBottom: `1px solid ${tokens.line}` }}>
            <Title order={2} fz={18}>
              {pluralize(created.created, 'user')} created
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              They can log in to the staff console now with the temporary passwords from your file, and will choose their own straight away.
            </Text>
          </div>
          <RowsTable rows={created.rows} showPassword={false} />
          <Group justify="flex-end" px={20} py={16} gap={8} style={{ borderTop: `1px solid ${tokens.line}` }}>
            <Button variant="default" onClick={startOver}>
              Import another file
            </Button>
            <Button component={Link} to={staffPath('/users')}>
              Back to users
            </Button>
          </Group>
        </div>
      )}
    </>
  )
}
