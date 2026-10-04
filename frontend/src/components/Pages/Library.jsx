import { useState } from 'react';
import { Heart, ListMusic, Music, Plus, X } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import PageShell from '../Layout/PageShell';
import TrackCard from '../Cards/TrackCard';

const TABS = [
  { id: 'playlists', label: 'Playlists', Icon: ListMusic },
  { id: 'liked', label: 'Liked Songs', Icon: Heart },
  { id: 'recent', label: 'Recently Played', Icon: Music },
];

export default function Library() {
  const { likedSongs, playlists, recentlyPlayed, createPlaylist } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const [activeTab, setActiveTab] = useState('liked');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const recent = recentlyPlayed.slice(0, 24);

  function playList(tracks, track) {
    setQueue(tracks);
    playTrack(track);
  }

  function isThisPlaying(track) {
    return isPlaying && currentTrack?.id === track?.id && currentTrack?.source === track?.source;
  }

  function handleCreatePlaylist(e) {
    e.preventDefault();
    if (playlistName.trim()) {
      createPlaylist(playlistName.trim());
      setPlaylistName('');
      setShowCreateModal(false);
    }
  }

  return (
    <PageShell
      title="Your Library"
      description="Everything you've saved, in one place."
      actions={
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_20px_-4px_var(--color-accent-glow)]"
        >
          <Plus size={16} />
          New Playlist
        </button>
      }
    >
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-pressed={activeTab === id}
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-medium t-global ${
              activeTab === id
                ? 'border-transparent bg-accent text-white shadow-[0_0_18px_-6px_var(--color-accent-glow)]'
                : 'border-white/[0.07] bg-white/[0.05] text-label-secondary hover:border-accent-border hover:text-white'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'playlists' ? (
        playlists.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="rounded-[12px] border border-white/[0.06] bg-surface-raised p-3 t-global hover:border-accent-border"
              >
                <div className="flex aspect-square w-full items-center justify-center rounded-[10px] bg-gradient-to-br from-accent/25 to-accent-magenta/20">
                  <Music size={30} className="text-white/45" />
                </div>
                <p className="clamp-1 mt-2.5 text-[13px] font-medium leading-tight text-white">
                  {playlist.name}
                </p>
                <p className="mt-0.5 text-[12px] leading-tight text-label-secondary">
                  {playlist.tracks.length} song{playlist.tracks.length === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            Icon={ListMusic}
            message="No playlists yet"
            hint="Create a playlist to organize your music"
          />
        )
      ) : activeTab === 'liked' ? (
        likedSongs.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {likedSongs.map((track) => (
              <TrackCard
                key={`${track.source}-${track.id}`}
                track={track}
                isPlaying={isThisPlaying(track)}
                onPlay={() => playList(likedSongs, track)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            Icon={Heart}
            message="No liked songs yet"
            hint="Tap the heart on any song to build your collection"
          />
        )
      ) : recent.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {recent.map((track) => (
            <TrackCard
              key={`${track.source}-${track.id}`}
              track={track}
              isPlaying={isThisPlaying(track)}
              onPlay={() => playList(recent, track)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          Icon={Music}
          message="Nothing played yet"
          hint="Songs you listen to show up here automatically"
        />
      )}

      {/* Create playlist modal */}
      {showCreateModal ? (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create Playlist"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[16px] border border-white/[0.08] bg-surface-raised p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-white">New Playlist</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 t-global hover:bg-white/20"
              >
                <X size={15} className="text-white" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist}>
              <label htmlFor="playlist-name" className="sr-only">
                Playlist name
              </label>
              <input
                id="playlist-name"
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="My Playlist"
                autoFocus
                className="mb-4 w-full rounded-[8px] border border-transparent bg-white/[0.06] px-3 py-2.5 text-[13px] text-white placeholder:text-label-secondary t-global focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-accent py-2.5 text-[13px] font-semibold text-white t-global hover:bg-accent-hover"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setPlaylistName('');
                  }}
                  className="flex-1 rounded-full bg-white/[0.08] py-2.5 text-[13px] font-semibold text-white t-global hover:bg-white/[0.14]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function EmptyState({ Icon, message, hint }) {
  return (
    <div className="flex flex-col items-center rounded-[12px] border border-white/[0.06] bg-surface-raised py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft">
        <Icon size={24} className="text-accent" />
      </div>
      <p className="text-[15px] font-medium text-white">{message}</p>
      <p className="mt-1.5 text-[13px] text-label-secondary">{hint}</p>
    </div>
  );
}