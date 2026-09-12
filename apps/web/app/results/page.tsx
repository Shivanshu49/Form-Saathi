import type { Metadata } from 'next';
import { loadResults } from '../../lib/results';

export const metadata: Metadata = { title: 'परिणाम' };
export const dynamic = 'force-dynamic';

const conditionText = { A: 'NVDA + Gemini in Chrome', B: 'NVDA + पूरा फ़ॉर्म साथी', C: 'NVDA + फ़ॉर्म साथी, AI बंद' } as const;

function cell(value: number | null): string {
  return value === null ? '—' : String(value);
}

export default function Results() {
  const data = loadResults();
  return (
    <article className="space-y-8">
      <h1 className="text-3xl font-bold">मूल्यांकन के परिणाम</h1>
      <p className="max-w-[75ch]">
        यह पृष्ठ केवल वही दिखाता है जो <code lang="en">studies/results/</code> में वास्तव में दर्ज है, उसी schema से
        जो report generator उपयोग करता है। रिकॉर्ड में केवल छद्मनाम, स्थितियाँ, गिनतियाँ और अवधि होती हैं — कोई
        नाम, फ़ील्ड का मान या रिकॉर्डिंग नहीं। कम संख्याएँ किसी सामान्य दावे का आधार नहीं हैं।
      </p>
      {data.state === 'empty' ? (
        <section aria-labelledby="empty-heading" className="bordered space-y-2 border-l-4 border-amber bg-[#eee7d7] p-4">
          <h2 id="empty-heading" className="text-2xl font-bold">अभी कोई सत्र दर्ज नहीं</h2>
          <p>
            {data.files === 0 ? 'परिणाम फ़ोल्डर में कोई फ़ाइल नहीं है।' : `${data.files} फ़ाइल मिलीं, पर उनमें कोई सत्र नहीं है।`}{' '}
            कोई प्रतिभागी सत्र नहीं हुआ है और कोई मापा हुआ सुधार नहीं है। यहाँ कोई संख्या दिखाई नहीं जाएगी जब तक
            वास्तविक सत्र दर्ज न हों।
          </p>
        </section>
      ) : null}
      {data.state === 'invalid' ? (
        <section aria-labelledby="invalid-heading" className="bordered space-y-2 border-l-4 border-amber bg-[#eee7d7] p-4">
          <h2 id="invalid-heading" className="text-2xl font-bold">एक फ़ाइल schema से मेल नहीं खाती</h2>
          <p><span lang="en">{data.file}</span> को ठीक करें; तब तक कोई परिणाम नहीं दिखाया जाता।</p>
          <ul className="list-disc pl-6 text-sm" lang="en">{data.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </section>
      ) : null}
      {data.state === 'loaded' ? (
        <>
          <p>{data.files} फ़ाइल, {data.sessions.length} सत्र।</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="text-left font-bold">स्थिति के अनुसार सार</caption>
              <thead>
                <tr className="border-b-2 border-line text-left">
                  <th scope="col" className="py-2 pr-3">स्थिति</th><th scope="col" className="py-2 pr-3">सत्र</th><th scope="col" className="py-2 pr-3">प्रतिभागी</th>
                  <th scope="col" className="py-2 pr-3">पूरे</th><th scope="col" className="py-2 pr-3">औसत अवधि (s)</th><th scope="col" className="py-2 pr-3">औसत बची त्रुटियाँ</th>
                  <th scope="col" className="py-2 pr-3">औसत झूठी चेतावनियाँ</th><th scope="col" className="py-2 pr-3">औसत छूटी त्रुटियाँ</th><th scope="col" className="py-2 pr-3">सहायता</th><th scope="col" className="py-2">CAPTCHA (अलग)</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.map((row) => (
                  <tr key={row.condition} className="border-b border-line">
                    <th scope="row" className="py-2 pr-3 text-left font-bold">{row.condition}: {conditionText[row.condition]}</th>
                    <td className="py-2 pr-3">{row.sessions}</td><td className="py-2 pr-3">{row.participants}</td><td className="py-2 pr-3">{row.completed}</td>
                    <td className="py-2 pr-3">{cell(row.meanDurationSeconds)}</td><td className="py-2 pr-3">{cell(row.meanRemainingErrors)}</td>
                    <td className="py-2 pr-3">{cell(row.meanFalseWarnings)}</td><td className="py-2 pr-3">{cell(row.meanMissedErrors)}</td>
                    <td className="py-2 pr-3">{row.assistanceEvents}</td><td className="py-2">{row.captchaBlockers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </article>
  );
}
