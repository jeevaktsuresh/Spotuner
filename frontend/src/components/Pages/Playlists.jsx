import { useState } from 'react';
import { ListMusic, Music, Plus, X, Trash2 } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useQueue } from '../../context/QueueContext';
import PageShell from '../Layout/PageShell';
import SectionHeading from '../Layout/SectionHeading';
import TrackRow from '../Cards/TrackRow';

/**
 * Playlists — the listener's saved playlists.
 *
 * Read/write operations all come from LibraryContext (localStorage-backed);
 * this page is presentation plus a small create/confirm interaction.
 */
export default function Playlists() {
  const { playlists, likedSongs, recentlyPlayed, createPlaylist, deletePlaylist } = useLibrary();
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const { setQueue } = useQueue();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const recent = recentlyPlayed.slice(0, 8);

  function playList(tracks, track) {
    setQueue(tracks);
    playTrack(track);
  }

  function isThisPlaying(track) {
    return isPlaying && currentTrack?.id === track?.id && currentTrack?.source === track?.source;
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    createPlaylist(name.trim());
    setName('');
    setShowCreate(false);
  }

  return (
    <PageShell
      title="Playlists"
      description="Your own collections, ready to play."
      actions={
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_0_20px_-4px_var(--color-accent-glow)]"
        >
          <Plus size={16} />
          New Playlist
        </button>
      }
    >
      {/* Inline create form — avoids a modal for a single text field */}
      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="mb-6 flex max-w-md gap-2 rounded-[12px] border border-accent-border bg-surface-raised p-3"
        >
          <label htmlFor="new-playlist" className="sr-only">
            Playlist name
          </label>
          <input
            id="new-playlist"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Playlist"
            autoFocus
            className="min-w-0 flex-1 rounded-[8px] border border-transparent bg-white/[0.06] px-3 py-2 text-[13px] text-white placeholder:text-label-secondary t-global focus:border-accent-border focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <button
            type="submit"
            className="shrink-0 rounded-[8px] bg-accent px-4 text-[13px] font-semibold text-white t-global hover:bg-accent-hover"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setName('');
            }}
            aria-label="Cancel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-label-secondary t-global hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </form>
      ) : null}

      {/* ===== Saved playlists ===== */}
      <section className="mb-10">
        <SectionHeading title="Your Playlists" subtitle={`${playlists.length} total`} />

        {playlists.length === 0 ? (
          <EmptyState
            Icon={ListMusic}
            message="No playlists yet"
            hint="Create a playlist to organize your music"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {playlists.map((playlist) => {
              const expanded = expandedId === playlist.id;

              return (
                <div
                  key={playlist.id}
                  className="group overflow-hidden rounded-[12px] border border-white/[0.06] bg-surface-raised t-global hover:border-accent-border"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : playlist.id)}
                    aria-expanded={expanded}
                    className="block w-full p-3 text-left"
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
                  </button>

                  {expanded && playlist.tracks.length > 0 ? (
                    <div className="border-t border-white/[0.07] px-2 py-2">
                      {playlist.tracks.map((track, i) => (
                        <TrackRow
                          key={`${track.source}-${track.id}`}
                          track={track}
                          index={i}
                          isPlaying={isThisPlaying(track)}
                          onPlay={() => playList(playlist.tracks, track)}
                        />
                      ))}
                    </div>
                  ) : null}

                  {expanded ? (
                    <div className="border-t border-white/[0.07] px-3 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          deletePlaylist(playlist.id);
                          setExpandedId(null);
                        }}
                        className="flex items-center gap-1.5 text-[12px] font-medium text-label-secondary t-global hover:text-red-400"
                      >
                        <Trash2 size={13} />
                        Delete playlist
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== Liked songs ===== */}
      {likedSongs.length > 0 ? (
        <section className="mb-10">
          <SectionHeading
            title="Liked Songs"
            subtitle={`${likedSongs.length} saved`}
            action={
              <button
                type="button"
                onClick={() => playList(likedSongs, likedSongs[0])}
                className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[13px] font-semibold text-white t-global hover:border-accent-border hover:bg-accent-soft"
              >
                Play all
              </button>
            }
          />

          <div className="space-y-0.5">
            {likedSongs.map((track, i) => (
              <TrackRow
                key={`${track.source}-${track.id}`}
                track={track}
                index={i}
                isPlaying={isThisPlaying(track)}
                onPlay={() => playList(likedSongs, track)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ===== Recently played ===== */}
      {recent.length > 0 ? (
        <section>
          <SectionHeading title="Recently Played" />
          <div className="space-y-0.5">
            {recent.map((track, i) => (
              <TrackRow
                key={`${track.source}-${track.id}`}
                track={track}
                index={i}
                isPlaying={isThisPlaying(track)}
                onPlay={() => playList(recent, track)}
              />
            ))}
          </div>
        </section>
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