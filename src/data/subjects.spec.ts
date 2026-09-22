import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SUBJECTS, subjectById, totalMaxScoreOf } from './subjects'
import { isBlankAnswer } from '../lib/grading'

const DEMO_LABELS = ['满分示例', '中等示例', '零分示例']

describe('题库完整性', () => {
  it('每个科目都是 10 道题，且题目 id 全局唯一', () => {
    const seen = new Set<string>()
    for (const subject of SUBJECTS) {
      expect(subject.questions).toHaveLength(10)
      for (const question of subject.questions) {
        expect(seen.has(question.id)).toBe(false)
        seen.add(question.id)
      }
    }
  })

  it('题目编号连续，rubric / 演示作答 / 档位都完整', () => {
    for (const subject of SUBJECTS) {
      subject.questions.forEach((question, index) => {
        expect(question.no).toBe(index + 1)
        expect(question.stem.trim().length).toBeGreaterThan(0)
        expect(question.standardAnswer.trim().length).toBeGreaterThan(0)
        expect(question.kindLabel.trim().length).toBeGreaterThan(0)
        expect(question.defaultMaxScore).toBeGreaterThan(0)

        expect(question.levels.length).toBeGreaterThanOrEqual(2)
        expect(question.levels.length).toBeLessThanOrEqual(10)
        for (const level of question.levels) expect(level.trim().length).toBeGreaterThan(0)

        expect(question.demoAnswers).toHaveLength(DEMO_LABELS.length)
        for (const demo of question.demoAnswers) expect(demo.label.trim().length).toBeGreaterThan(0)
      })
    }
  })

  it('演示题库不使用选择题，每题都有合法的得分点', () => {
    for (const subject of SUBJECTS) {
      for (const question of subject.questions) {
        expect(question.choice).toBeUndefined()
        expect(question.rubric.length).toBeGreaterThan(0)
        const ids = new Set<string>()
        for (const point of question.rubric) {
          expect(point.label.trim().length).toBeGreaterThan(0)
          expect(point.weight).toBeGreaterThan(0)
          expect(ids.has(point.id)).toBe(false)
          ids.add(point.id)
        }
      }
    }
  })

  it('每题至少有一个满分示例（非空）和可判 0 的答案', () => {
    for (const subject of SUBJECTS) {
      for (const question of subject.questions) {
        const [full, , zero] = question.demoAnswers
        expect(full.content.trim().length).toBeGreaterThan(0)
        expect(isBlankAnswer(zero.content)).toBe(false)
      }
    }
  })

  it('内置演示截图指向 public/ 下真实存在的图片', () => {
    const withScreenshot = SUBJECTS.flatMap((subject) => subject.questions).filter(
      (question) => question.demoScreenshot,
    )
    expect(withScreenshot.length).toBeGreaterThan(0)
    for (const question of withScreenshot) {
      const demo = question.demoScreenshot
      if (!demo) continue
      expect(demo.label.trim().length).toBeGreaterThan(0)
      expect(demo.src.startsWith('/')).toBe(true)
      expect(existsSync(resolve(process.cwd(), 'public', demo.src.replace(/^\//, '')))).toBe(true)
    }
  })

  it('subjectById 与总分计算可用', () => {
    expect(subjectById('math').label).toBe('数学')
    expect(subjectById('unknown-id').id).toBe(SUBJECTS[0].id)
    for (const subject of SUBJECTS) {
      expect(totalMaxScoreOf(subject)).toBe(
        subject.questions.reduce((sum, question) => sum + question.defaultMaxScore, 0),
      )
      expect(totalMaxScoreOf(subject)).toBeGreaterThan(0)
    }
  })
})

describe('各科目判分措辞', () => {
  it('英语科目只含写作题', () => {
    const english = subjectById('english')
    for (const question of english.questions) {
      expect(question.rubric.length).toBeGreaterThan(0)
      expect(question.defaultMaxScore).toBeGreaterThanOrEqual(15)
    }
  })

  it('全科都不再出现选择题型标注', () => {
    for (const subject of SUBJECTS) {
      for (const question of subject.questions) {
        expect(question.kindLabel).not.toContain('选择')
        expect(question.stem).not.toContain('（　　）')
      }
    }
  })
})