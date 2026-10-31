import { Title } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import classes from './Layout.module.css'

/** A titled panel. */
export function Section({ title, aside, children, id }: { title: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className={`panel ${classes.section}`} aria-labelledby={id}>
      <div className={classes.sectionHead}>
        <Title order={2} fz={16} id={id}>
          {title}
        </Title>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={classes.back}>
      <IconArrowLeft size={14} stroke={1.75} />
      {children}
    </Link>
  )
}
