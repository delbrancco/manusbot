import { useState, useEffect, useCallback } from 'react'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase-client'
import type { ModuleWithLessons, Lesson, LessonMaterial } from '../types/lessons'
import { resolveLessonVideoId, youtubeEmbedSrc, youtubeWatchUrl } from '../lib/youtube'
import bannerImg from '../assets/banner.png'

const MATERIAL_LABELS: Record<string, string> = {
  pdf: 'PDF',
  sheet: 'Planilha',
  link: 'Link',
  video: 'Vídeo',
  document: 'Doc',
  other: 'Arquivo',
}

function MaterialTypeBadge({ type }: { type: string }) {
  return <span className="material-type-badge">{MATERIAL_LABELS[type] ?? 'Arquivo'}</span>
}

async function openMaterialUrl(url: string) {
  try {
    await window.manusPro?.appOpenExternal?.(url)
  } catch (err) {
    console.error('[AULAS] Erro ao abrir material:', err)
  }
}

export default function Aulas() {
  const [modules, setModules] = useState<ModuleWithLessons[]>([])
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [embedContext, setEmbedContext] = useState<{ origin: string; pageUrl: string } | null>(null)
  const [playerEpoch, setPlayerEpoch] = useState(0)

  useEffect(() => {
    void window.manusPro?.appGetEmbedOrigin?.()
      .then((ctx) => setEmbedContext(ctx))
      .catch(() => {
        if (typeof window !== 'undefined' && window.location?.protocol !== 'file:') {
          setEmbedContext({
            origin: window.location.origin,
            pageUrl: window.location.href,
          })
        }
      })
  }, [])

  useEffect(() => {
    void window.manusPro?.appGetUserId?.().then(({ userId: uid }) => {
      setUserId(uid)
    }).catch((err) => {
      console.error('[AULAS] Erro ao obter user_id:', err)
    })
  }, [])

  const loadContent = useCallback(async () => {
    setLoading(true)
    try {
      const { data: mods, error: modsErr } = await supabase
        .from('modules')
        .select('*')
        .eq('is_published', true)
        .order('order_index', { ascending: true })

      if (modsErr) {
        console.error('[AULAS] Erro modules:', modsErr)
        setModules([])
        return
      }

      if (!mods?.length) {
        setModules([])
        setSelectedLesson(null)
        return
      }

      const { data: lessons, error: lessonsErr } = await supabase
        .from('lessons')
        .select('*')
        .eq('is_published', true)
        .order('order_index', { ascending: true })

      if (lessonsErr) {
        console.error('[AULAS] Erro lessons:', lessonsErr)
      }

      const { data: materials, error: matsErr } = await supabase
        .from('lesson_materials')
        .select('*')
        .order('order_index', { ascending: true })

      if (matsErr) {
        console.error('[AULAS] Erro materials:', matsErr)
      }

      const lessonsByModule = new Map<string, Lesson[]>()
      lessons?.forEach((l) => {
        const arr = lessonsByModule.get(l.module_id) ?? []
        arr.push({
          ...l,
          materials: materials?.filter((m) => m.lesson_id === l.id) ?? [],
        })
        lessonsByModule.set(l.module_id, arr)
      })

      const withLessons = mods.map((m) => ({
        ...m,
        lessons: lessonsByModule.get(m.id) ?? [],
      }))

      setModules(withLessons)
      setExpandedModules(new Set(withLessons.length > 0 ? [withLessons[0].id] : []))

      const firstLesson = withLessons.find((m) => m.lessons.length > 0)?.lessons[0] ?? null
      setSelectedLesson(firstLesson)
    } catch (err) {
      console.error('[AULAS] Erro ao carregar:', err)
      setModules([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProgress = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lesson-progress-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json().catch(() => ({}))
      setWatchedIds(new Set(data.watched_lesson_ids ?? []))
    } catch (err) {
      console.error('[AULAS] Erro ao carregar progresso:', err)
    }
  }, [userId])

  useEffect(() => {
    void loadContent()
  }, [loadContent])

  useEffect(() => {
    if (userId) void loadProgress()
  }, [userId, loadProgress])

  async function markAsWatched(lessonId: string) {
    if (!userId) return
    const newWatched = !watchedIds.has(lessonId)

    setWatchedIds((prev) => {
      const next = new Set(prev)
      if (newWatched) next.add(lessonId)
      else next.delete(lessonId)
      return next
    })

    try {
      await fetch(`${SUPABASE_URL}/functions/v1/lesson-progress-mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          user_id: userId,
          lesson_id: lessonId,
          is_watched: newWatched,
        }),
      })
    } catch (err) {
      console.error('[AULAS] Erro ao marcar:', err)
      setWatchedIds((prev) => {
        const next = new Set(prev)
        if (newWatched) next.delete(lessonId)
        else next.add(lessonId)
        return next
      })
    }
  }

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const watchedCount = watchedIds.size
  const progress = totalLessons > 0 ? Math.round((watchedCount / totalLessons) * 100) : 0
  const selectedVideoId = selectedLesson ? resolveLessonVideoId(selectedLesson) : null
  const selectedEmbedSrc =
    selectedVideoId && selectedVideoId !== 'about:blank'
      ? youtubeEmbedSrc(selectedVideoId, {
          origin: embedContext?.origin,
          pageUrl: embedContext?.pageUrl,
        })
      : null

  if (loading) {
    return (
      <div className="aulas-page page-content">
        <div className="aulas-loading-state">
          <div className="aulas-loading-spinner" aria-hidden />
          <p>Carregando aulas...</p>
        </div>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="aulas-page page-content">
        <div className="aulas-empty-state">
          <p className="aulas-empty-title">Nenhuma aula disponível</p>
          <p className="aulas-empty-desc">Volte em breve — novos conteúdos serão publicados em breve.</p>
        </div>
      </div>
    )
  }

  function reloadPlayer() {
    setPlayerEpoch((n) => n + 1)
  }

  function selectLesson(lesson: Lesson) {
    setSelectedLesson(lesson)
    setPlayerEpoch((n) => n + 1)
    requestAnimationFrame(() => {
      document.querySelector('.aulas-player-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  return (
    <div className="aulas-page page-content">
      <header className="aulas-top">
        <div className="aulas-top-intro">
          <h1 className="aulas-title">Aulas</h1>
          <p className="aulas-subtitle">Trilha completa de uso do Manusia</p>
        </div>
        <div className="aulas-progress-card" aria-label={`Progresso: ${watchedCount} de ${totalLessons}`}>
          <div className="aulas-progress-head">
            <span className="aulas-progress-label">Progresso da trilha</span>
            <span className="aulas-progress-value">
              {watchedCount}/{totalLessons} · {progress}%
            </span>
          </div>
          <div className="aulas-progress-track">
            <div className="aulas-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <img
        src={bannerImg}
        alt="Banner Membros Manusia"
        className="aulas-banner"
      />

      {selectedLesson ? (
        <>
          <section className="aulas-player-section" aria-label="Vídeo da aula">
            <div className="video-player-toolbar">
              {selectedVideoId && (
                <button
                  type="button"
                  className="video-reload-btn"
                  onClick={reloadPlayer}
                >
                  Recarregar player
                </button>
              )}
            </div>
            <div className="video-player-shell">
              <div className="video-player">
                {selectedEmbedSrc ? (
                  <iframe
                    key={`${selectedLesson.id}-${selectedVideoId}-${playerEpoch}`}
                    src={selectedEmbedSrc}
                    title={selectedLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="video-player-placeholder">
                    <p>Vídeo indisponível — verifique a URL do YouTube no painel admin.</p>
                    {selectedLesson.youtube_url && (
                      <button
                        type="button"
                        className="video-open-youtube-btn"
                        onClick={() => void openMaterialUrl(selectedLesson.youtube_url)}
                      >
                        Abrir link configurado
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="aulas-lesson-panel">
            <div className="aulas-lesson-panel-head">
              <div>
                <h2 className="aula-detail-title">{selectedLesson.title}</h2>
                {selectedVideoId && (
                  <button
                    type="button"
                    className="video-open-youtube-link"
                    onClick={() => void openMaterialUrl(youtubeWatchUrl(selectedVideoId))}
                  >
                    Assistir no YouTube
                  </button>
                )}
                {selectedLesson.description && (
                  <p className="aula-detail-desc">{selectedLesson.description}</p>
                )}
              </div>
              <button
                type="button"
                className={[
                  'btn-mark-watched',
                  watchedIds.has(selectedLesson.id) ? 'watched' : '',
                ].join(' ')}
                onClick={() => void markAsWatched(selectedLesson.id)}
                disabled={!userId}
                title={!userId ? 'Valide seu email para salvar progresso' : undefined}
              >
                {watchedIds.has(selectedLesson.id)
                  ? 'Assistida'
                  : 'Marcar como assistida'}
              </button>
            </div>

            {!userId && (
              <p className="aula-progress-hint">
                Valide seu email no início do app para sincronizar o progresso.
              </p>
            )}

            {(selectedLesson.materials?.length ?? 0) > 0 && (
              <div className="aula-materiais-block">
                <h3 className="aula-materiais-heading">Materiais complementares</h3>
                <ul className="aula-materiais-list">
                  {selectedLesson.materials!.map((m: LessonMaterial) => (
                    <li key={m.id} className="material-item">
                      <MaterialTypeBadge type={m.type} />
                      <span className="material-title">{m.title}</span>
                      <button
                        type="button"
                        className="material-open-btn"
                        onClick={() => void openMaterialUrl(m.url)}
                      >
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="aulas-content-empty">
          <p>Role para baixo e selecione uma aula na trilha para começar.</p>
        </div>
      )}

      <section className="aulas-trilha" aria-label="Módulos e aulas">
        <h2 className="aulas-trilha-title">Conteúdo da trilha</h2>
        <p className="aulas-trilha-hint">Role para ver todos os módulos e escolher a próxima aula.</p>
        <div className="aulas-trilha-list">
          {modules.map((module) => (
            <div key={module.id} className="module-section">
              <button
                type="button"
                onClick={() => toggleModule(module.id)}
                className="module-header"
              >
                <span className="module-chevron" aria-hidden>
                  {expandedModules.has(module.id) ? '▼' : '▶'}
                </span>
                <span className="module-title">{module.title}</span>
                <span className="module-counter">
                  {module.lessons.filter((l) => watchedIds.has(l.id)).length}/{module.lessons.length}
                </span>
              </button>

              {expandedModules.has(module.id) && (
                <div className="module-lessons">
                  {module.lessons.length === 0 ? (
                    <p className="module-lessons-empty">Sem aulas neste módulo ainda.</p>
                  ) : (
                    module.lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => selectLesson(lesson)}
                        className={[
                          'lesson-item',
                          selectedLesson?.id === lesson.id ? 'active' : '',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'lesson-status',
                            watchedIds.has(lesson.id) ? 'is-watched' : '',
                          ].join(' ')}
                          aria-hidden
                        >
                          {watchedIds.has(lesson.id) ? '✓' : ''}
                        </span>
                        <span className="lesson-item-title">{lesson.title}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
