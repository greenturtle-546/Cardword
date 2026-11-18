import { useState } from 'react';
import { syncFromGoogleSheet } from '../services/sheetSync';

export function SyncButton({ deckId }: { deckId: string }) {
  const [status, setStatus] = useState('Sync from Google Sheets');

  const handleSync = async () => {
    setStatus('Syncing...');
    try {
      const { added, updated } = await syncFromGoogleSheet(deckId);
      setStatus(`Done! Added: ${added} | Updated: ${updated}`);
      setTimeout(() => setStatus('Sync from Google Sheets'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('Sync Failed');
    }
  };

  return (
    <button 
      onClick={handleSync} 
      style={{ padding: '12px', background: '#4F46E5', color: 'white', borderRadius: '8px', width: '100%', margin: '10px 0', fontWeight: 'bold', border: 'none' }}
    >
      {status}
    </button>
  );
}