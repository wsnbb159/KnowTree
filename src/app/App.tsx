/**
 * 应用外壳。
 * 视图切换保持在本地 state —— 知树是纯前端作品，没有路由后端，
 * 「一个链接直接打开就能用」比 URL 语义更重要。
 */

import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { getTree, getAllCourses } from '@/data/courses';
import { CapturePanel } from '@/views/CapturePanel';
import { DiagnosisView } from '@/views/DiagnosisView';
import { TreeView } from '@/views/TreeView';
import { ProfileView } from '@/views/ProfileView';
import { NotebookView } from '@/views/NotebookView';
import { TeacherView } from '@/views/TeacherView';
import { SettingsPanel } from '@/views/SettingsPanel';

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

type TabId = 'capture' | 'diagnosis' | 'tree' | 'profile' | 'notebook' | 'teacher' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'capture', label: '拍题诊断' },
  { id: 'diagnosis', label: '诊断报告' },
  { id: 'tree', label: '知识树' },
  { id: 'profile', label: '学情画像' },
  { id: 'notebook', label: '错题本' },
  { id: 'teacher', label: '教师端' },
  { id: 'settings', label: '设置' },
];

function Shell() {
  const {
    courseId,
    setCourseId,
    courseName,
    engineLabel,
    engineMode,
    activeDiagnosis,
    error,
    due,
    stats,
  } = useStore();
  const [tab, setTab] = useState<TabId>('capture');

  /* 新诊断完成 → 自动切到报告页，学生的视线跟着流程走 */
  useEffect(() => {
    if (activeDiagnosis) setTab('diagnosis');
  }, [activeDiagnosis]);

  const navigate = (next: string) => setTab(next as TabId);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--surface-page)]/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <KnowTreeLogo />
            <div>
              <div className="text-[15px] font-medium leading-tight tracking-tight text-ink-900">
                知树 KnowTree
              </div>
              <div className="text-[11px] leading-tight text-ink-400">
                拍下不会的题 · 告诉你卡在哪
              </div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value as typeof courseId)}
              className="rounded-lg border border-[var(--line-strong)] bg-white px-2.5 py-1.5 text-[12.5px] text-ink-700 outline-none transition focus:border-brand-400"
              aria-label="选择课程"
            >
              {getAllCourses().map((course) => (
                <option
                  key={course.id}
                  value={course.id}
                  disabled={!getTree(course.id)}
                >
                  {course.name}
                  {getTree(course.id) ? '' : '（规划中）'}
                </option>
              ))}
            </select>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${
                engineMode === 'remote'
                  ? 'border-brand-200 bg-brand-50 text-brand-800'
                  : 'border-[var(--line)] bg-[var(--surface-sunken)] text-ink-600'
              }`}
              title={engineLabel}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  engineMode === 'remote' ? 'bg-brand-600' : 'bg-ink-400'
                }`}
              />
              {engineLabel}
            </span>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl px-2 sm:px-4">
          <ul className="kt-scroll flex gap-1 overflow-x-auto">
            {TABS.map((item) => {
              const disabled = item.id === 'diagnosis' && !activeDiagnosis;
              const active = tab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setTab(item.id)}
                    className={`relative whitespace-nowrap px-3 py-2.5 text-[13px] transition ${
                      active
                        ? 'font-medium text-ink-900'
                        : 'text-ink-600 hover:text-ink-900'
                    } ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                  >
                    {item.label}
                    {item.id === 'notebook' && due.length > 0 ? (
                      <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E24B4A] px-1 text-[10px] font-medium text-white">
                        {due.length}
                      </span>
                    ) : null}
                    {active ? (
                      <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-brand-600" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {error ? (
          <div className="mb-5 rounded-card border border-[#F7C1C1] bg-[#FCEBEB] px-4 py-3 text-[13px] text-[#A32D2D]">
            {error}
          </div>
        ) : null}

        {tab === 'capture' ? <CapturePanel onNavigate={navigate} /> : null}
        {tab === 'diagnosis' ? (
          <DiagnosisView onGoCapture={() => setTab('capture')} onNavigate={navigate} />
        ) : null}
        {tab === 'tree' ? <TreeView /> : null}
        {tab === 'profile' ? <ProfileView onNavigate={navigate} /> : null}
        {tab === 'notebook' ? <NotebookView onNavigate={navigate} /> : null}
        {tab === 'teacher' ? <TeacherView /> : null}
        {tab === 'settings' ? <SettingsPanel /> : null}
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-[11.5px] text-ink-400 sm:px-6">
          <span>
            知树 KnowTree · {courseName} · {stats.total} 个知识点已建模
          </span>
          <span>学情数据仅存本机浏览器 · 粤港澳大湾区 AI Coding 创新大赛作品</span>
        </div>
      </footer>
    </div>
  );
}

function KnowTreeLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#0F6E56" />
      <path
        d="M20 8c3.5 3 5.5 5.8 5.5 8.6 0 3-2.4 5.2-5.5 5.2s-5.5-2.2-5.5-5.2C14.5 13.8 16.5 11 20 8Z"
        fill="#9FE1CB"
      />
      <path
        d="M20 22.5c-3.9 0-7.3 1.7-9.2 4.4h18.4c-1.9-2.7-5.3-4.4-9.2-4.4Z"
        fill="#5DCAA5"
      />
      <rect x="19" y="26" width="2" height="6.5" rx="1" fill="#E1F5EE" />
    </svg>
  );
}
