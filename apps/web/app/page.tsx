import Link from 'next/link';
import { livePortalSupport, supportText, workflowTitle } from '../lib/content';

export default function Home() {
  return (
    <article className="space-y-8">
      <header className="space-y-3 border-t-4 border-teal pt-5">
        <p className="text-sm font-bold text-teal">विकास संस्करण · पायलट से पहले</p>
        <h1 className="max-w-[30ch] text-4xl font-bold leading-tight">फ़ॉर्म समझें। अपनी गति से आगे बढ़ें।</h1>
        <p className="max-w-[75ch]">
          फ़ॉर्म साथी desktop Chrome के लिए एक साइड-पैनल एक्सटेंशन है। यह स्क्रीन रीडर — विशेषकर NVDA — के
          साथ काम करते हुए सरकारी फ़ॉर्म के फ़ील्ड हिंदी में समझने, उन पर जाने और भरी हुई जानकारी की
          स्थानीय जाँच करने में मदद करता है। सरकारी पेज को पढ़ने का काम एक्सटेंशन का है; यह वेबसाइट
          इंस्टॉल, सीखने और अभ्यास के लिए है।
        </p>
      </header>

      <section aria-labelledby="does-heading" className="space-y-3">
        <h2 id="does-heading" className="text-2xl font-bold">यह क्या करता है</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>आपके चालू किए गए टैब के फ़ॉर्म फ़ील्ड, उनके लेबल, निर्देश और मान पैनल में पढ़ता है।</li>
          <li>कीबोर्ड से फ़ील्ड पर आगे-पीछे ले जाता है और पेज के मूल फ़ील्ड पर फ़ोकस भेजता है।</li>
          <li>समीक्षित स्थानीय नियमों से जाँचता है और हर नतीजे का स्रोत बताता है।</li>
          <li>आपकी अनुमति पर बोले हुए मान को सुझाव में बदलता है — जिसे आप स्वयं भरते हैं।</li>
        </ul>
      </section>

      <section aria-labelledby="not-heading" className="space-y-3 border-l-4 border-amber pl-4">
        <h2 id="not-heading" className="text-2xl font-bold">यह क्या नहीं करता</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>कभी कोई फ़ील्ड अपने आप नहीं भरता, Submit नहीं दबाता, CAPTCHA हल नहीं करता।</li>
          <li>पात्रता, पहचान या आवेदन की स्वीकृति तय नहीं करता। समीक्षा का अर्थ स्वीकृति नहीं है।</li>
          <li>किसी सरकारी संस्था से संबद्ध नहीं है, और हर वेबसाइट पर काम करने का दावा नहीं करता।</li>
        </ul>
      </section>

      <section aria-labelledby="status-heading" className="space-y-3">
        <h2 id="status-heading" className="text-2xl font-bold">लाइव समर्थन की स्थिति</h2>
        <dl className="space-y-3">
          {(Object.keys(livePortalSupport) as (keyof typeof livePortalSupport)[]).map((workflow) => (
            <div key={workflow} className="bordered rounded border border-line bg-card p-4">
              <dt className="font-bold" lang="en">{workflowTitle[workflow]}</dt>
              <dd>{supportText[livePortalSupport[workflow]]}</dd>
            </div>
          ))}
        </dl>
        <p>
          किसी भी कार्यप्रवाह का वास्तविक पोर्टल पर परीक्षण अभी नहीं हुआ है। <Link href="/limitations" className="text-teal">सीमाएँ पढ़ें</Link>।
        </p>
      </section>

      <nav aria-label="आगे" className="flex flex-wrap gap-4">
        <Link href="/install" className="rounded border-2 border-teal bg-teal px-4 py-3 font-bold text-white no-underline">इंस्टॉल करें</Link>
        <Link href="/practice" className="rounded border-2 border-teal px-4 py-3 font-bold text-teal no-underline">अभ्यास फ़ॉर्म खोलें</Link>
      </nav>
    </article>
  );
}
