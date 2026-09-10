import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'

// Google Client IDs for frontend apps are public by design, so it's safe to hardcode here for GitHub Pages.
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '382674408500-1ol0opaqvql0n1cb794cibuh9qtlivfq.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
