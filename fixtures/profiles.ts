// Invented exercise values, never real applications or reserved official IDs.
// Expected findings are authored separately in expected-results.md.
export const profiles = {
  nsp: {
    a: {
      reference: 'KAVYA SAIN',
      complete: {
        'nsp-name': 'KAVYA SAIN', 'nsp-dob': '15/08/2004', 'nsp-gender': 'महिला',
        'nsp-otr': '90000000000001', 'nsp-state': 'उत्तर प्रदेश',
        'nsp-district': 'lucknow', 'nsp-address': '12, काल्पनिक अभ्यास पथ',
        'nsp-pin': '226001', 'nsp-locality': 'other', 'nsp-locality-other': 'अभ्यास क्षेत्र एक',
        'nsp-detail': '123456789012',
      },
      issues: {
        'nsp-name': 'KAVYA SAI', 'nsp-dob': '31/02/2004',
        'nsp-otr': '9000000000001', 'nsp-district': '', 'nsp-locality-other': '',
      },
    },
    b: {
      reference: 'NEHA DASS',
      complete: {
        'nsp-name': 'NEHA DASS', 'nsp-dob': '16/08/2005', 'nsp-gender': 'महिला',
        'nsp-otr': '90000000000002', 'nsp-state': 'उत्तर प्रदेश',
        'nsp-district': 'kanpur', 'nsp-address': '24, काल्पनिक अभ्यास पथ',
        'nsp-pin': '208001', 'nsp-locality': 'other', 'nsp-locality-other': 'अभ्यास क्षेत्र दो',
        'nsp-detail': '234567890123',
      },
      issues: {
        'nsp-name': 'NEHA DAS', 'nsp-dob': '31/02/2005',
        'nsp-otr': '9000000000002', 'nsp-district': '', 'nsp-locality-other': '',
      },
    },
  },
  eci: {
    a: {
      reference: 'ARUN DEV',
      complete: {
        'eci-name-hi': 'अरुण देव', 'eci-name-en': 'ARUN DEV', 'eci-gender': 'male',
        'eci-dob': '15/08/2000', 'eci-age-proof': 'other',
        'eci-age-proof-other': 'काल्पनिक आयु अभिलेख एक',
        'eci-address': '36, काल्पनिक अभ्यास गली', 'eci-district': 'लखनऊ',
        'eci-state': 'उत्तर प्रदेश', 'eci-pin': '226001', 'eci-email': '',
        'eci-detail': '345678901234',
      },
      issues: {
        'eci-name-en': 'ARUN DE', 'eci-dob': '31/02/2000',
        'eci-age-proof-other': '', 'eci-district': '', 'eci-pin': '22601',
      },
    },
    b: {
      reference: 'AMAN ROY',
      complete: {
        'eci-name-hi': 'अमन रॉय', 'eci-name-en': 'AMAN ROY', 'eci-gender': 'male',
        'eci-dob': '16/08/2001', 'eci-age-proof': 'other',
        'eci-age-proof-other': 'काल्पनिक आयु अभिलेख दो',
        'eci-address': '48, काल्पनिक अभ्यास गली', 'eci-district': 'कानपुर नगर',
        'eci-state': 'उत्तर प्रदेश', 'eci-pin': '208001', 'eci-email': '',
        'eci-detail': '456789012345',
      },
      issues: {
        'eci-name-en': 'AMAN RO', 'eci-dob': '31/02/2001',
        'eci-age-proof-other': '', 'eci-district': '', 'eci-pin': '20801',
      },
    },
  },
} as const;
