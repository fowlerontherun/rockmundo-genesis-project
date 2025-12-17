import { AvatarCreator, AvatarCreatorConfig, AvatarExportedEvent } from '@readyplayerme/react-avatar-creator';

interface ReadyPlayerMeCreatorProps {
  onAvatarCreated: (avatarUrl: string, avatarId: string) => void;
  onClose?: () => void;
}

const config: AvatarCreatorConfig = {
  clearCache: true,
  bodyType: 'fullbody',
  quickStart: false,
  language: 'en',
};

export const ReadyPlayerMeCreator = ({ onAvatarCreated, onClose }: ReadyPlayerMeCreatorProps) => {
  const handleExport = (event: AvatarExportedEvent) => {
    // URL format: https://models.readyplayer.me/{avatarId}.glb
    const url = event.data.url;
    // Extract avatar ID from URL
    const avatarId = url.split('/').pop()?.replace('.glb', '') || '';
    onAvatarCreated(url, avatarId);
  };

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border border-border">
      <AvatarCreator
        subdomain="demo" // Using demo subdomain - replace with your own subdomain for production
        config={config}
        style={{ width: '100%', height: '100%', border: 'none' }}
        onAvatarExported={handleExport}
      />
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 bg-background/80 rounded-full hover:bg-background"
        >
          ✕
        </button>
      )}
    </div>
  );
};
