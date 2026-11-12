'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@markerit/ui';
import {
  Check,
  Languages,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import {
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  deleteMyAvatar,
} from '@markerit/api-client';
import type { UserProfileDto } from '@markerit/api-client';
import { getMessages, type TranslationMessages } from '@markerit/i18n';
import type { UserProfile } from '../types';
import { assetContentUrl } from '../../lib/assets';
import { setAppLocale, useAppLocale } from '../../lib/use-app-locale';
import { SecuritySettings } from './security-settings';
import { settingsErrorMessage } from './settings-errors';
import { cn } from 'cn';

type SettingsTab = 'profile' | 'security' | 'preferences';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated?: (profile: UserProfile) => void;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg'];

export function toUiProfile(profile: UserProfileDto): UserProfile {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    initials: profile.initials,
    avatarUrl:
      profile.avatarAssetId != null
        ? assetContentUrl(profile.avatarAssetId)
        : undefined,
    locale: profile.locale,
  };
}

export function SettingsDialog({
  open,
  onOpenChange,
  onProfileUpdated,
}: SettingsDialogProps) {
  const { messages } = useAppLocale();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const showLoading = loading || (open && !profile && !loadError);
  const profileUpdatedRef = useRef(onProfileUpdated);
  profileUpdatedRef.current = onProfileUpdated;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setProfile(null);
    try {
      const loaded = await getMyProfile();
      setProfile(loaded);
      setAppLocale(loaded.locale);
      profileUpdatedRef.current?.(toUiProfile(loaded));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadProfile();
  }, [open, loadProfile]);

  useEffect(() => {
    if (open) return;
    setProfile(null);
    setLoadError(false);
    setLoading(false);
  }, [open]);

  function handleProfileUpdate(updated: UserProfileDto) {
    setProfile(updated);
    profileUpdatedRef.current?.(toUiProfile(updated));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        closeLabel={messages.settings.close}
        className="flex h-[min(88dvh,780px)] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-5 text-primary" aria-hidden="true" />
            {messages.settings.title}
          </DialogTitle>
          <DialogDescription>{messages.settings.description}</DialogDescription>
        </DialogHeader>

        {showLoading ? (
          <SettingsSkeleton messages={messages} />
        ) : loadError || !profile ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">{messages.settings.loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void loadProfile()}
            >
              <RefreshCw className="size-3.5" />
              {messages.settings.retry}
            </Button>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as SettingsTab)}
            orientation="vertical"
            className="flex min-h-0 flex-1 flex-col md:flex-row"
          >
            <TabsList className="h-auto w-full shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-muted/30 p-2 md:w-56 md:flex-col md:items-stretch md:overflow-visible md:border-b-0 md:border-r">
              <SettingsTabTrigger value="profile" icon={<UserRound />} label={messages.settings.profileTab} />
              <SettingsTabTrigger value="security" icon={<ShieldCheck />} label={messages.settings.securityTab} />
              <SettingsTabTrigger value="preferences" icon={<Languages />} label={messages.settings.preferencesTab} />
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <TabsContent value="profile" className="mt-0">
                <ProfileSettings
                  profile={profile}
                  messages={messages}
                  onProfileUpdated={handleProfileUpdate}
                />
              </TabsContent>
              <TabsContent value="security" className="mt-0" keepMounted>
                <SecuritySettings
                  profile={profile}
                  onProfileUpdated={handleProfileUpdate}
                />
              </TabsContent>
              <TabsContent value="preferences" className="mt-0">
                <PreferencesSettings
                  messages={messages}
                  onProfileUpdated={handleProfileUpdate}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsTabTrigger({
  value,
  icon,
  label,
}: {
  value: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="justify-start gap-2 whitespace-nowrap px-3 py-2 data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-2xs md:w-full"
    >
      <span className="[&>svg]:size-4">{icon}</span>
      {label}
    </TabsTrigger>
  );
}

function SettingsSkeleton({ messages }: { messages: TranslationMessages }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row" aria-busy="true">
      <p role="status" className="sr-only">
        {messages.settings.loading}
      </p>
      <div className="space-y-2 border-b border-border p-3 md:w-56 md:border-b-0 md:border-r">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

interface ProfileSettingsProps {
  profile: UserProfileDto;
  messages: TranslationMessages;
  onProfileUpdated: (profile: UserProfileDto) => void;
}

function ProfileSettings({ profile, messages, onProfileUpdated }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(profile.displayName);
  }, [profile.displayName]);

  const trimmedName = displayName.trim();
  const nameInvalid = trimmedName.length < 2 || trimmedName.length > 80;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameInvalid) {
      setError(
        trimmedName.length < 2
          ? messages.settings.displayNameTooShort
          : messages.settings.displayNameTooLong,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateMyProfile({ displayName: trimmedName });
      onProfileUpdated(updated);
      setNotice(messages.settings.saved);
    } catch (cause) {
      setError(settingsErrorMessage(cause, messages));
    } finally {
      setBusy(false);
    }
  }

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError(messages.settings.avatarUnsupported);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(messages.settings.avatarTooLarge);
      return;
    }
    setAvatarBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await uploadMyAvatar(file);
      onProfileUpdated(updated);
      setNotice(messages.settings.avatarUpdated);
    } catch (cause) {
      setError(settingsErrorMessage(cause, messages));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await deleteMyAvatar();
      onProfileUpdated(updated);
      setNotice(messages.settings.avatarRemoved);
    } catch (cause) {
      setError(settingsErrorMessage(cause, messages));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <section>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {messages.settings.profileTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.settings.profileDescription}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border/80 p-4 sm:flex-row sm:items-center">
        <Avatar size="lg" className="size-20 bg-primary/15 text-primary">
          {profile.avatarAssetId && (
            <AvatarImage src={assetContentUrl(profile.avatarAssetId)} alt="" />
          )}
          <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
            {profile.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {messages.settings.avatarTitle}
          </h3>
          <p className="text-xs text-muted-foreground">
            {messages.settings.avatarDescription}
          </p>
          <p className="text-xs text-muted-foreground">{messages.settings.avatarHint}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => void changeAvatar(event)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={avatarBusy}
              onClick={() => fileInput.current?.click()}
              className="gap-1.5"
            >
              <Upload className="size-3.5" />
              {messages.settings.chooseAvatar}
            </Button>
            {profile.avatarAssetId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={avatarBusy}
                onClick={() => void removeAvatar()}
                className="gap-1.5 text-muted-foreground"
              >
                <Trash2 className="size-3.5" />
                {messages.settings.removeAvatar}
              </Button>
            )}
          </div>
        </div>
      </section>

      <form className="space-y-4" onSubmit={saveProfile} noValidate>
        <div className="space-y-2">
          <Label htmlFor="settings-display-name">{messages.settings.displayNameLabel}</Label>
          <Input
            id="settings-display-name"
            value={displayName}
            maxLength={80}
            aria-invalid={nameInvalid && displayName.length > 0}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setError(null);
              setNotice(null);
            }}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">{messages.settings.displayNameHint}</p>
        </div>

        <div className="space-y-1.5 rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {messages.settings.accountEmailLabel}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {profile.email}
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              {messages.settings.emailVerified}
            </span>
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {notice}
          </p>
        )}

        <Button type="submit" size="sm" disabled={busy || nameInvalid || trimmedName === profile.displayName}>
          {busy ? messages.settings.saving : messages.settings.save}
        </Button>
      </form>
    </div>
  );
}

function PreferencesSettings({
  messages,
  onProfileUpdated,
}: {
  messages: TranslationMessages;
  onProfileUpdated: (profile: UserProfileDto) => void;
}) {
  const { locale } = useAppLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function chooseLocale(next: 'pl' | 'en') {
    if (next === locale) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateMyProfile({ locale: next });
      onProfileUpdated(updated);
      setAppLocale(next);
      setNotice(getMessages(next).settings.languageSaved);
    } catch (cause) {
      setError(settingsErrorMessage(cause, messages));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {messages.settings.preferencesTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.settings.preferencesDescription}
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-foreground">{messages.settings.languageLabel}</p>
        <p className="text-xs text-muted-foreground">{messages.settings.languageDescription}</p>
        <div
          role="radiogroup"
          aria-label={messages.settings.languageLabel}
          className="grid gap-2 sm:grid-cols-2"
        >
          {([
            { value: 'pl', label: messages.settings.polish },
            { value: 'en', label: messages.settings.english },
          ] as const).map((option) => {
            const selected = locale === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() => void chooseLocale(option.value)}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted/60',
                )}
              >
                {option.label}
                {selected && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}

    </div>
  );
}
