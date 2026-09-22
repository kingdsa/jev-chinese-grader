import type { SubjectBank } from '../data/subjects'

interface SubjectTabsProps {
  subjects: SubjectBank[]
  activeId: string
  gradedCounts: Record<string, number>
  running: boolean
  onChange: (id: string) => void
}

export function SubjectTabs(props: SubjectTabsProps) {
  return (
    <nav className="subjects" aria-label="科目切换">
      {props.subjects.map((subject) => {
        const graded = props.gradedCounts[subject.id] ?? 0
        const total = subject.questions.length
        const active = subject.id === props.activeId
        return (
          <button
            key={subject.id}
            type="button"
            className={active ? 'subject-tab is-active' : 'subject-tab'}
            onClick={() => props.onChange(subject.id)}
            disabled={props.running && !active}
          >
            <span className="subject-tab__label">{subject.label}</span>
            <span className="subject-tab__meta">
              {graded}/{total} 已批改
            </span>
          </button>
        )
      })}
    </nav>
  )
}