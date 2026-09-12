import { useState } from 'react';
import { healthResponseSchema } from '@form-saathi/contracts';
import { livePortalSupport } from '@form-saathi/rules';
import { API_ORIGIN } from '../../config';

const supportText = { unverified: 'वास्तविक फ़ॉर्म पर परीक्षण बाकी है।' };
const serviceText = {
  idle: 'सेवा की स्थिति अभी जाँची नहीं गई है।',
  checking: 'सेवा की स्थिति जाँची जा रही है…',
  ready: 'सेवा उपलब्ध है।',
  unavailable: 'सेवा से संपर्क नहीं हो पाया। कुछ देर बाद फिर जाँचें।',
};

export default function App() {
  const [service, setService] = useState<keyof typeof serviceText>('idle');

  async function checkService() {
    if (service === 'checking') return;
    setService('checking');
    try {
      const response = await fetch(`${API_ORIGIN}/health`, {
        signal: AbortSignal.timeout(5_000),
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Service unavailable');
      healthResponseSchema.parse(await response.json());
      setService('ready');
    } catch {
      setService('unavailable');
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-7 px-5 py-7 font-sans leading-relaxed text-stone-950">
      <header className="border-t-4 border-teal-900 pt-5">
        <p className="mb-2 text-sm font-bold text-teal-900">विकास संस्करण</p>
        <h1 className="text-3xl font-bold">फ़ॉर्म साथी</h1>
        <p className="mt-3">फ़ॉर्म समझें। अपनी गति से आगे बढ़ें।</p>
      </header>

      <section aria-labelledby="support-heading" className="space-y-4">
        <h2 id="support-heading" className="text-xl font-bold">सहायता की स्थिति</h2>
        <p>फ़ॉर्म के फ़ील्ड पढ़ना, नेविगेशन और समीक्षा अभी उपलब्ध नहीं हैं।</p>
        <dl className="space-y-4 border-l-4 border-amber-700 pl-4">
          <div>
            <dt className="font-bold" lang="en">National Scholarship Portal</dt>
            <dd>{supportText[livePortalSupport.nsp]}</dd>
          </div>
          <div>
            <dt className="font-bold" lang="en">ECI Form 6</dt>
            <dd>{supportText[livePortalSupport.eciForm6]}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="service-heading" className="space-y-4 border-t border-stone-400 pt-5">
        <h2 id="service-heading" className="text-xl font-bold">सेवा से संपर्क</h2>
        <p id="service-help">यह जाँच केवल सेवा से संपर्क करती है। फ़ॉर्म की जानकारी नहीं भेजती।</p>
        <button
          type="button"
          onClick={checkService}
          aria-describedby="service-help"
          aria-disabled={service === 'checking'}
          className="min-h-12 w-full rounded-md border-2 border-teal-950 bg-teal-900 px-4 py-3 font-bold text-white hover:bg-teal-950 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-teal-900 aria-disabled:cursor-wait"
        >
          सेवा की स्थिति जाँचें
        </button>
        <output aria-live="polite" aria-atomic="true" className="block min-h-14">{serviceText[service]}</output>
      </section>
    </main>
  );
}
