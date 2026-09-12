import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'कीबोर्ड और NVDA' };

const keys: [string, string][] = [
  ['टूलबार बटन या Alt+Shift+F', 'मौजूदा टैब के लिए पैनल खोलें और उसका फ़ॉर्म पढ़ें।'],
  ['Tab / Shift+Tab', 'पैनल में क्रम: फ़ॉर्म फिर पढ़ें → पिछला फ़ील्ड → अगला फ़ील्ड → मूल फ़ील्ड पर जाएँ → पढ़कर सुनाएँ → पढ़ना रोकें → संदर्भ → समीक्षा → फ़ील्ड सूची।'],
  ['Enter या Space', 'किसी भी बटन को चलाएँ। “पिछला/अगला फ़ील्ड” पेज को नहीं छूते; केवल “मूल फ़ील्ड पर जाएँ” और सूची के बटन पेज में फ़ोकस भेजते हैं।'],
  ['F6', 'पेज से वापस पैनल पर आने के लिए। यदि आपके Chrome में F6 पैनल पर न लाए तो Alt+Shift+F से पैनल फिर खोलें।'],
  ['NVDA browse mode (H, T, F)', 'पैनल के शीर्षक, समीक्षा की तालिका और फ़ॉर्म फ़ील्ड में तेज़ी से जाएँ। दर्ज जानकारी एक तालिका है; तालिका कमांड से पढ़ें।'],
];

export default function Guide() {
  return (
    <article className="space-y-8">
      <h1 className="text-3xl font-bold">कीबोर्ड और NVDA से उपयोग</h1>
      <p className="max-w-[75ch]">
        पैनल का हर काम कीबोर्ड से होता है। पैनल एक ही स्थिति-क्षेत्र में बोलता है और किसी क्रिया को दोहराता
        नहीं; किसी मान के बदलने पर कुछ नहीं बोला जाता, नया फ़ील्ड आने पर एक बार बोला जाता है।
      </p>
      <table className="w-full border-collapse">
        <caption className="text-left font-bold">कुंजियाँ और उनका काम</caption>
        <thead>
          <tr className="border-b-2 border-line text-left"><th scope="col" className="py-2 pr-4">कुंजी</th><th scope="col" className="py-2">काम</th></tr>
        </thead>
        <tbody>
          {keys.map(([key, action]) => (
            <tr key={key} className="border-b border-line align-top"><th scope="row" className="py-2 pr-4 text-left font-bold">{key}</th><td className="py-2">{action}</td></tr>
          ))}
        </tbody>
      </table>
      <section aria-labelledby="review-heading" className="space-y-3">
        <h2 id="review-heading" className="text-2xl font-bold">समीक्षा के तीन हिस्से</h2>
        <dl className="space-y-2">
          <div><dt className="font-bold">सुधार चाहिए</dt><dd>स्थानीय नियम ने कमी पाई। “फ़ील्ड पर जाएँ” से पेज में जाकर स्वयं सुधारें।</dd></div>
          <div><dt className="font-bold">पुष्टि चाहिए</dt><dd>दो बातें मेल नहीं खातीं, जैसे नाम की वर्तनी। अपने दस्तावेज़ से आप तय करें।</dd></div>
          <div><dt className="font-bold">जाँचा नहीं गया</dt><dd>इसकी जाँच हो ही नहीं सकी। इसका अर्थ “सब ठीक है” नहीं है।</dd></div>
        </dl>
      </section>
      <section aria-labelledby="voice-heading" className="space-y-3">
        <h2 id="voice-heading" className="text-2xl font-bold">आवाज़ें</h2>
        <p className="max-w-[75ch]">
          “पढ़कर सुनाएँ” केवल आपके कंप्यूटर पर चलने वाली हिंदी आवाज़ का उपयोग करता है और कभी अपने आप नहीं बोलता। हिंदी
          आवाज़ न मिले तो पैनल बताता है और पाठ NVDA के लिए वहीं रहता है। लंबी पहचान-संख्याएँ तब तक छिपी रहती हैं
          जब तक आप “पूरा मान दिखाएँ” न दबाएँ।
        </p>
      </section>
      <p className="border-l-4 border-amber pl-4">
        NVDA के साथ इस पैनल का मानवीय परीक्षण अभी नहीं हुआ है। यह मार्गदर्शन डिज़ाइन पर आधारित है, अनुभव पर नहीं।
      </p>
    </article>
  );
}
