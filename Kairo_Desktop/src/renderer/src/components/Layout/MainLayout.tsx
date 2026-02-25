import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import FileExplorer from '@renderer/components/Sidebar/FileExplorer'
import ProjectManager from '@renderer/components/Sidebar/ProjectManager'
import CodeEditor from '@renderer/components/Editor/CodeEditor'
import TerminalPanel from '@renderer/components/Terminal/TerminalPanel'
import ChatPanel from '@renderer/components/Chat/ChatPanel'

export default function MainLayout(): React.JSX.Element {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Main vertical split: top (panels) + bottom (chat) */}
      <Allotment vertical defaultSizes={[70, 30]}>
        {/* Top section: sidebar | editor+terminal */}
        <Allotment.Pane>
          <Allotment defaultSizes={[20, 80]}>
            {/* Sidebar */}
            <Allotment.Pane minSize={150} maxSize={400}>
              <div style={{ height: '100%', backgroundColor: '#171717', borderRight: '1px solid #404040', overflowY: 'auto' }}>
                <Allotment vertical defaultSizes={[60, 40]}>
                  <Allotment.Pane>
                    <FileExplorer />
                  </Allotment.Pane>
                  <Allotment.Pane>
                    <ProjectManager />
                  </Allotment.Pane>
                </Allotment>
              </div>
            </Allotment.Pane>

            {/* Right: Editor (top) + Terminal (bottom) */}
            <Allotment.Pane>
              <Allotment vertical defaultSizes={[65, 35]}>
                <Allotment.Pane>
                  <CodeEditor />
                </Allotment.Pane>
                <Allotment.Pane minSize={100}>
                  <TerminalPanel />
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>
          </Allotment>
        </Allotment.Pane>

        {/* Bottom: Chat panel */}
        <Allotment.Pane minSize={150}>
          <ChatPanel />
        </Allotment.Pane>
      </Allotment>
    </div>
  )
}
