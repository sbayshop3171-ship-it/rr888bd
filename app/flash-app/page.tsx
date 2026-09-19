'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { openInstallSheet, usePwaInstall } from '@/components/usePwaInstall';
import { SITE_SETTINGS_DEFAULTS, type SiteSettings } from '@/lib/site-settings';

const ratingBreakdown = [
  { label: '5', value: 76 },
  { label: '4', value: 16 },
  { label: '3', value: 5 },
  { label: '2', value: 2 },
  { label: '1', value: 1 },
];

const reviews = [
  {
    name: 'Miguel',
    date: '28 Aug 2025',
    text: 'Fun games with generous prizes',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  },
  {
    name: 'Greg Blake',
    date: '22 Sep 2025',
    text: 'A very fun casual game that can also earn you money.',
    avatar:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
  },
];

const footerLinks = ['শর্তাবলী', 'গোপনীয়তা', 'ফেরত নীতি', 'ডেভেলপার তথ্য'];

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 8a3 3 0 1 0-2.82-4H12a3 3 0 0 0 3 3Zm0 0 5-3M15 16a3 3 0 1 0-2.82 4H12a3 3 0 0 0 3-3Zm0 0-5 3M9 12a3 3 0 1 0-2.82-4H6a3 3 0 0 0 3 3Zm0 0 8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-6.5-4.3L5.5 20V6A1.5 1.5 0 0 1 7 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" fill="currentColor"/>
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
      <circle cx="12" cy="19" r="1.6" fill="currentColor"/>
    </svg>
  );
}

export default function FlashAppPage() {
  const router = useRouter();
  const { canInstall, needsIosSteps, install, installed, openApp } = usePwaInstall();
  const [settings, setSettings] = useState<SiteSettings>(SITE_SETTINGS_DEFAULTS);
  const [installing, setInstalling] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone && window.location.pathname === '/flash-app') {
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/site-settings', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; settings?: Partial<SiteSettings> };
        if (!data.settings) return;

        const screenshotsData = data.settings.flashApp?.screenshots ?? [];
        console.log('Screenshots Data:', screenshotsData);

        const next: SiteSettings = {
          ...SITE_SETTINGS_DEFAULTS,
          ...data.settings,
          support: { ...SITE_SETTINGS_DEFAULTS.support, ...data.settings.support },
          flashApp: {
            ...SITE_SETTINGS_DEFAULTS.flashApp,
            ...(data.settings.flashApp ?? {}),
            screenshots: screenshotsData.length
              ? screenshotsData.filter(Boolean)
              : SITE_SETTINGS_DEFAULTS.flashApp.screenshots,
          },
        };
        setSettings(next);
      } catch {
        // keep the shipped defaults if the settings API is unavailable
      }
    }

    void load();
  }, []);

  const screenshots = settings.flashApp.screenshots?.length ? settings.flashApp.screenshots : SITE_SETTINGS_DEFAULTS.flashApp.screenshots;
  const appName = settings.flashApp.appName || SITE_SETTINGS_DEFAULTS.flashApp.appName;
  const shortName = settings.flashApp.shortName || SITE_SETTINGS_DEFAULTS.flashApp.shortName;
  const appTagline = settings.flashApp.tagline || SITE_SETTINGS_DEFAULTS.flashApp.tagline;
  const appLogo = settings.flashApp.logoUrl || SITE_SETTINGS_DEFAULTS.flashApp.logoUrl;

  const closeLightbox = () => setSelectedImageIndex(null);
  const showPreviousImage = () => {
    setSelectedImageIndex((current) => current === null ? null : (current - 1 + screenshots.length) % screenshots.length);
  };
  const showNextImage = () => {
    setSelectedImageIndex((current) => current === null ? null : (current + 1) % screenshots.length);
  };

  useEffect(() => {
    if (selectedImageIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') showPreviousImage();
      if (event.key === 'ArrowRight') showNextImage();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedImageIndex, screenshots.length]);

  const handleLightboxTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleLightboxTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45) return;
    if (distance > 0) showPreviousImage();
    else showNextImage();
  };

  const handleInstall = async () => {
    if (installed) {
      openApp();
      return;
    }

    if (canInstall) {
      setInstalling(true);
      const accepted = await install();
      setInstalling(false);
      if (accepted) {
        router.push('/');
      }
      return;
    }

    if (needsIosSteps) {
      openInstallSheet();
      return;
    }

    openInstallSheet();
  };

  return (
    <main className="flash-app-page" lang="bn">
      <div className="flash-app-device">
        <section className="flash-app-card">
          <div className="flash-app-hero">
            <div className="flash-app-appmeta">
              <img
                className="flash-app-icon"
                src={appLogo}
                alt={`${appName} app icon`}
              />
              <div className="flash-app-appmeta__text">
                <h1>{appName}</h1>
                <p>{shortName}</p>
                <span>{appTagline}</span>
              </div>
            </div>

            <div className="flash-app-stats">
              <div className="flash-app-stat">
                <div className="flash-app-stat__value">5.0★</div>
                <div className="flash-app-stat__label">2.1K রিভিউ</div>
              </div>
              <div className="flash-app-stat">
                <div className="flash-app-stat__value">2470.1K+</div>
                <div className="flash-app-stat__label">ডাউনলোড</div>
              </div>
              <div className="flash-app-stat">
                <div className="flash-app-stat__value">18+</div>
                <div className="flash-app-stat__label">রেটেড</div>
              </div>
            </div>

            <button type="button" className="flash-app-cta" onClick={() => void handleInstall()} disabled={installing}>
              <span className="flash-app-cta__icon"><LightningIcon /></span>
              {installed ? 'অ্যাপ খুলুন' : installing ? 'ইনস্টল হচ্ছে…' : needsIosSteps ? 'হোম স্ক্রিনে যোগ করুন' : 'দ্রুত ইনস্টলেশন'}
            </button>

            <div className="flash-app-actions">
              <button type="button" className="flash-app-chip">
                <span className="flash-app-chip__icon"><ShareIcon /></span>
                শেয়ার করুন
              </button>
              <button type="button" className="flash-app-chip">
                <span className="flash-app-chip__icon"><BookmarkIcon /></span>
                ইচ্ছাতালিকায় যোগ করুন
              </button>
            </div>
          </div>

          <div className="flash-app-screenshots">
            {screenshots.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                className="flash-app-screenshot-button"
                onClick={() => setSelectedImageIndex(index)}
                aria-label={`Open ${appName} app preview ${index + 1}`}
              >
                <img src={src} alt={`${appName} app preview ${index + 1}`} />
              </button>
            ))}
          </div>

          <div className="flash-app-data">
            <div className="flash-app-section-heading">ডাটা সুরক্ষা</div>
            <p>
              আপনার নিরাপত্তা শুরু হয় এই বোঝার মাধ্যমে যে ডেভেলপাররা কীভাবে আপনার ডাটা
              সংগ্রহ ও শেয়ার করেন। ডাটা সুরক্ষা ও গোপনীয়তা নীতি ব্যবহারের ধরন, অঞ্চল ও বয়স
              অনুযায়ী পরিবর্তিত হতে পারে।
            </p>
            <div className="flash-app-data__grid">
              <div className="flash-app-data__item">
                <span className="flash-app-data__icon">🔒</span>
                <div>
                  <strong>ডাটা সংগ্রহ</strong>
                  <small>অবস্থান, ব্যক্তিগত তথ্য, আর্থিক তথ্য</small>
                </div>
              </div>
              <div className="flash-app-data__item">
                <span className="flash-app-data__icon">🔄</span>
                <div>
                  <strong>শেয়ারিং</strong>
                  <small>তৃতীয় পক্ষের পরিষেবা ও বিশ্লেষণ</small>
                </div>
              </div>
              <div className="flash-app-data__item">
                <span className="flash-app-data__icon">🧩</span>
                <div>
                  <strong>সংরক্ষণ</strong>
                  <small>ডাটা এনক্রিপ্ট করা নেই</small>
                </div>
              </div>
            </div>
          </div>

          <div className="flash-app-ratings">
            <div className="flash-app-section-heading">রেটিং এবং রিভিউ</div>

            <div className="flash-app-rating-overview">
              <div className="flash-app-rating-score">
                <div className="flash-app-rating-score__big">5.0</div>
                <div className="flash-app-rating-score__stars" aria-label="Five star rating">
                  ★★★★★
                </div>
                <div className="flash-app-rating-score__count">2,067</div>
              </div>

              <div className="flash-app-bars" aria-label="Rating distribution">
                {ratingBreakdown.map((row) => (
                  <div key={row.label} className="flash-app-bar-row">
                    <span>{row.label}</span>
                    <div className="flash-app-bar-track">
                      <div className="flash-app-bar-fill" style={{ width: `${row.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flash-app-filter-tabs">
              <span className="active">টেলিফোন</span>
              <span>ট্যাবলেট</span>
              <span>ক্রোমবুক</span>
            </div>

            <div className="flash-app-review-list">
              {reviews.map((review) => (
                <article key={review.name} className="flash-app-review-card">
                  <div className="flash-app-review-card__top">
                    <img src={review.avatar} alt={review.name} />
                    <div className="flash-app-review-card__meta">
                      <h3>{review.name}</h3>
                      <div className="flash-app-stars">★★★★★</div>
                      <div className="flash-app-review-card__date">{review.date}</div>
                    </div>
                    <button type="button" className="flash-app-more" aria-label={`More for ${review.name}`}>
                      <MoreIcon />
                    </button>
                  </div>
                  <p>{review.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="flash-app-footer">
          <div className="flash-app-footer__links">
            {footerLinks.map((link) => (
              <button key={link} type="button" className="flash-app-footer__link">
                {link}
              </button>
            ))}
          </div>
          <div className="flash-app-footer__note">সমস্ত মুসল্লি কর অন্তর্ভুক্ত</div>
        </footer>
      </div>

      {selectedImageIndex !== null && (
        <div
          className="flash-app-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${appName} screenshot preview`}
          onClick={closeLightbox}
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
        >
          <button
            type="button"
            className="flash-app-lightbox__close"
            onClick={closeLightbox}
            aria-label="Close screenshot preview"
          >
            ×
          </button>
          <button
            type="button"
            className="flash-app-lightbox__arrow flash-app-lightbox__arrow--prev"
            onClick={(event) => { event.stopPropagation(); showPreviousImage(); }}
            aria-label="Previous screenshot"
          >
            ‹
          </button>
          <img
            className="flash-app-lightbox__image"
            src={screenshots[selectedImageIndex]}
            alt={`${appName} app preview ${selectedImageIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="flash-app-lightbox__arrow flash-app-lightbox__arrow--next"
            onClick={(event) => { event.stopPropagation(); showNextImage(); }}
            aria-label="Next screenshot"
          >
            ›
          </button>
          <div className="flash-app-lightbox__count">
            {selectedImageIndex + 1} / {screenshots.length}
          </div>
        </div>
      )}
    </main>
  );
}
