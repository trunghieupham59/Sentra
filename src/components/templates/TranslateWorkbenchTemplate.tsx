import type { ReactNode } from 'react'

export interface TranslateWorkbenchTemplateProps {
  titleId: string
  layout?: 'single' | 'comparison'
  header: ReactNode
  languageControls: ReactNode
  sourcePanel: ReactNode
  resultPanel: ReactNode
}

/**
 * Layout-only shell for the AI Translation workspace.
 *
 * The page owns data and behavior; this template only establishes the shared
 * workbench geometry so source and result remain one coherent task surface.
 */
export function TranslateWorkbenchTemplate({
  titleId,
  layout = 'single',
  header,
  languageControls,
  sourcePanel,
  resultPanel,
}: TranslateWorkbenchTemplateProps) {
  return (
    <div className="app-page translate-page">
      <div className="translate-workspace">
        {header}
        <section
          className={`translate-workbench translate-workbench-${layout}`}
          aria-labelledby={titleId}
          data-layout={layout}
        >
          {languageControls}
          {sourcePanel}
          {resultPanel}
        </section>
      </div>
    </div>
  )
}
