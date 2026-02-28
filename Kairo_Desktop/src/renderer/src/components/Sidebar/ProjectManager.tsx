import { useState, useCallback } from 'react'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useProject } from '@renderer/hooks/useProject'

export default function ProjectManager(): React.JSX.Element {
  const projects = useProjectStore((s) => s.projects)
  const activeProject = useProjectStore((s) => s.activeProject)
  const isLoading = useProjectStore((s) => s.isLoading)
  const error = useProjectStore((s) => s.error)
  const { createProject, loadProject, selectFolder } = useProject()

  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFolder, setNewFolder] = useState('')

  const handlePickFolder = useCallback(async () => {
    const folder = await selectFolder()
    if (folder) {
      setNewFolder(folder)
    }
  }, [selectFolder])

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newFolder.trim()) return
    const ok = await createProject(newName.trim(), newFolder.trim())
    if (ok) {
      setNewName('')
      setNewFolder('')
      setShowForm(false)
    }
  }, [newName, newFolder, createProject])

  return (
    <div style={{ padding: '12px', fontSize: '13px', color: '#a3a3a3' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#737373', margin: 0 }}>
          Projects
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'none', border: 'none', color: '#a3a3a3', cursor: 'pointer',
            fontSize: '16px', padding: '0 4px', lineHeight: 1,
          }}
          title={showForm ? 'Cancel' : 'New project'}
        >
          {showForm ? '\u00d7' : '+'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#fca5a5', fontSize: '12px', marginBottom: '8px' }}>{error}</div>
      )}

      {showForm && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              width: '100%', padding: '4px 8px', marginBottom: '4px',
              backgroundColor: '#262626', border: '1px solid #404040', borderRadius: '4px',
              color: '#e5e5e5', fontSize: '12px', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            <input
              type="text"
              placeholder="Folder path"
              value={newFolder}
              readOnly
              style={{
                flex: 1, padding: '4px 8px',
                backgroundColor: '#262626', border: '1px solid #404040', borderRadius: '4px',
                color: '#e5e5e5', fontSize: '12px',
              }}
            />
            <button
              onClick={handlePickFolder}
              style={{
                padding: '4px 8px', backgroundColor: '#404040', border: 'none',
                borderRadius: '4px', color: '#e5e5e5', fontSize: '12px', cursor: 'pointer',
              }}
            >
              ...
            </button>
          </div>
          <button
            onClick={handleCreate}
            disabled={isLoading || !newName.trim() || !newFolder.trim()}
            style={{
              width: '100%', padding: '4px 8px',
              backgroundColor: '#3b82f6', border: 'none', borderRadius: '4px',
              color: '#fff', fontSize: '12px', cursor: 'pointer',
              opacity: (isLoading || !newName.trim() || !newFolder.trim()) ? 0.5 : 1,
            }}
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {projects.length === 0 && !showForm && (
        <p style={{ fontStyle: 'italic', margin: 0 }}>No projects</p>
      )}

      {projects.map((project) => (
        <div
          key={project.id}
          onClick={() => loadProject(project.id)}
          style={{
            padding: '6px 8px', marginBottom: '2px', borderRadius: '4px', cursor: 'pointer',
            backgroundColor: activeProject?.id === project.id ? '#1e3a5f' : 'transparent',
            borderLeft: activeProject?.id === project.id ? '2px solid #3b82f6' : '2px solid transparent',
          }}
        >
          <div style={{ fontSize: '13px', color: '#e5e5e5' }}>{project.name}</div>
          <div style={{ fontSize: '11px', color: '#737373', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.folderPath}
          </div>
        </div>
      ))}
    </div>
  )
}
