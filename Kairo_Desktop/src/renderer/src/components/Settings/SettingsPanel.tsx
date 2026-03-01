import { useState } from 'react'
import AccountManager from './AccountManager'
import BudgetPresetSelector from './BudgetPresetSelector'
import VisibilityToggle from './VisibilityToggle'

const sectionStyle: React.CSSProperties = {
  borderTop: '1px solid #333',
  paddingTop: '14px',
  marginTop: '14px',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#d4d4d4',
  marginBottom: '10px',
}

export default function SettingsPanel(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          background: 'none', border: 'none', color: '#a3a3a3',
          cursor: 'pointer', fontSize: '13px', padding: '4px 8px',
        }}
        title="Settings"
      >
        Settings
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: '#1a1a1a', border: '1px solid #404040', borderRadius: '8px',
        padding: '20px', width: '420px', maxHeight: '70vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e5e5e5', margin: 0 }}>
            Settings
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'none', border: 'none', color: '#a3a3a3',
              cursor: 'pointer', fontSize: '18px', padding: '0 4px',
            }}
          >
            {'\u00d7'}
          </button>
        </div>

        {/* Section: Accounts */}
        <AccountManager />

        {/* Section: Token Budget */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Token Budget</div>
          <BudgetPresetSelector />
        </div>

        {/* Section: Response Style */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>Response Style</div>
          <VisibilityToggle />
        </div>
      </div>
    </div>
  )
}
