import { useState } from 'react';
import { syncFromGoogleSheet } from '../services/sheetSync';

// 'deckId' is now optional so App.tsx doesn't break
export function SyncButton({ deckId }: { deckId?: string }) { 
  const [status, setStatus] = useState('Sync from Google Sheets');

  const handleSync = async () => {
    setStatus('Syncing...');
    try {
      const { added, updated } = await syncFromGoogleSheet();
      setStatus(`Done! Added: ${added} | Updated: ${updated}`);
      // Force reload so Skola updates the UI immediately
      setTimeout(() => window.location.reload(), 1500); 
    } catch (error: any) {
      console.error(error);
      setStatus(error.message || 'Sync Failed');
      setTimeout(() => setStatus('Sync from Google Sheets'), 3000);
    }
  };

  return (
    <button 
      onClick={handleSync} 
      style={{ 
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, 
        padding: '16px 24px', background: '#4F46E5', color: 'white', 
        borderRadius: '50px', fontWeight: 'bold', border: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer'
      }}
    >
      {status}
    </button>
  );
}