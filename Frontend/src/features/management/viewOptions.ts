import { createContext, useContext } from 'react'

/**
 * Choices that change how the whole page reads. For now: whether the Refined oils class is shown as one
 * group or split into its products. It lives in the URL, so a shared link shows the same view.
 */
export interface ViewOptions {
  split: boolean
  toggleSplit: () => void
}

export const ViewOptionsContext = createContext<ViewOptions>({ split: false, toggleSplit: () => undefined })
export const useViewOptions = () => useContext(ViewOptionsContext)
