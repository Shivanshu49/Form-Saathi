import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'इंस्टॉल' };

const steps = [
  'Chrome 116 या नया desktop Chrome चाहिए। पैकेज फ़ाइल form-saathiextension-0.1.0-chrome.zip को किसी फ़ोल्डर में unzip करें।',
  'Chrome में chrome://extensions खोलें और ऊपर दाईं ओर Developer mode चालू करें।',
  'Load unpacked चुनें और unzip किया हुआ फ़ोल्डर चुनें। Chrome अभी Web Store के बाहर zip सीधे इंस्टॉल नहीं करता।',
  'Extensions मेनू से फ़ॉर्म साथी को टूलबार पर pin करें।',
  'किसी फ़ॉर्म वाले टैब पर टूलबार का बटन दबाएँ, या Alt+Shift+F दबाएँ। पैनल उसी टैब के लिए खुलता है। शॉर्टकट chrome://extensions/shortcuts पर बदल सकते हैं।',
];

export default function Install() {
  return (
    <article className="space-y-8">
      <h1 className="text-3xl font-bold">इंस्टॉल</h1>
      <p className="max-w-[75ch]">
        अभी यह एक्सटेंशन Chrome Web Store पर नहीं है। पायलट के लिए एक पैकेज फ़ाइल दी जाती है जिसे आप स्वयं
        लोड करते हैं। इसके लिए कोई खाता, कुंजी या दस्तावेज़ नहीं चाहिए।
      </p>
      <ol className="list-decimal space-y-3 pl-6">
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <section aria-labelledby="permissions-heading" className="space-y-3">
        <h2 id="permissions-heading" className="text-2xl font-bold">यह किन अनुमतियों का उपयोग करता है</h2>
        <dl className="space-y-2">
          <div><dt className="inline font-bold" lang="en">sidePanel</dt><dd className="inline"> — साइड पैनल खोलने के लिए।</dd></div>
          <div><dt className="inline font-bold" lang="en">activeTab, scripting</dt><dd className="inline"> — केवल उस टैब को पढ़ने के लिए जिस पर आप बटन दबाते हैं। किसी और वेबसाइट तक पहुँच नहीं माँगी जाती।</dd></div>
          <div><dt className="inline font-bold" lang="en">tts</dt><dd className="inline"> — आपके कंप्यूटर की हिंदी आवाज़ से पढ़कर सुनाने के लिए, केवल आपके कहने पर।</dd></div>
          <div><dt className="inline font-bold" lang="en">storage</dt><dd className="inline"> — पायलट क्रेडेंशियल और क्लाउड सहमति को केवल इस ब्राउज़र सत्र में रखने के लिए; ब्राउज़र बंद होने पर मिट जाता है।</dd></div>
        </dl>
      </section>
      <section aria-labelledby="cloud-heading" className="space-y-3">
        <h2 id="cloud-heading" className="text-2xl font-bold">क्लाउड सुविधा (वैकल्पिक)</h2>
        <p className="max-w-[75ch]">
          फ़ील्ड पढ़ना, नेविगेशन और जाँच बिना किसी सर्वर के चलते हैं। बोलकर बताने की सुविधा के लिए पायलट
          संचालक एक समय-सीमित क्रेडेंशियल देता है, जिसे आप पैनल के “क्लाउड सुविधा” भाग में भरते हैं।
          एक्सटेंशन में कोई कुंजी नहीं होती।
        </p>
      </section>
    </article>
  );
}
