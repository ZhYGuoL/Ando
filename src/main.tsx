import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import App from './App'
import CompletionCardReviewPage from './CompletionCardReviewPage'
import PermissionCardReviewPage from './PermissionCardReviewPage'
import './index.css'

const root = document.getElementById('root')!
const hash = typeof window !== 'undefined' ? window.location.hash : ''

const ReviewPage =
  hash === '#permission-card-review'
    ? PermissionCardReviewPage
    : hash === '#completion-card-review'
      ? CompletionCardReviewPage
      : null

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {ReviewPage ? <ReviewPage /> : <App />}
  </React.StrictMode>,
)
