import { useState } from 'react';
import { syncFromGoogleSheet } from '../services/sheetSync';
import { IconRefresh } from "@tabler/icons-react"; // Import an icon

export function SyncButton({ deckId }: { deckId?: string }) { 
  const [status, setStatus] = useState('Sync Google Sheets');

  const handleSync = async () => {
    setStatus('Syncing...');
    try {
      const { added, updated } = await syncFromGoogleSheet();
      setStatus(`Done! (+${added}, ^${updated})`);
      setTimeout(() => window.location.reload(), 1500); 
    } catch (error: any) {
      console.error(error);
      setStatus(error.message || 'Sync Failed');
      setTimeout(() => setStatus('Sync Google Sheets'), 3000);
    }
  };

  return (
    <button 
      onClick={handleSync} 
      style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '10px 12px', 
        background: 'transparent', 
        color: 'var(--text-color)', // Matches Skola's theme
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        textAlign: 'left',
        marginTop: 'auto' // Pushes it to the bottom of the sidebar
      }}
      onMouseOver={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <IconRefresh size={18} />
      {status}
    </button>
  );
}