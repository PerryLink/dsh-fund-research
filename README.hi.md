<div align="center">

# 📊 dsh-fund-research

**DeepSeek Harness पर चीनी सार्वजनिक म्यूचुअल फंडों के लिए नियतिवादी शोध रिपोर्ट।**

*हर रिपोर्ट का हर प्रमुख आँकड़ा हैश किए गए स्रोत स्नैपशॉट तक जाता है — अंतराल घोषित किए जाते हैं, कभी गढ़े नहीं जाते। केवल शोध; निवेश सलाह नहीं।*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-🧩-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-fund-research/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-fund-research/actions)
[![npm version](https://img.shields.io/npm/v/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)
[![npm downloads](https://img.shields.io/npm/dm/dsh-fund-research)](https://www.npmjs.com/package/dsh-fund-research)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibility

| घटक | संस्करण |
|---|---|
| DeepSeek Harness | `0.1.0-rc.8` (peer निर्भरताएँ पिन की गईं) |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| पैकेज प्रबंधक | `pnpm@11.7.0` |
| प्लेटफ़ॉर्म | Windows / macOS / Linux (केवल होस्ट प्लगइन) |
| डेटा स्रोत | Tiantian Fund / Eastmoney सार्वजनिक एंडपॉइंट (बिना key, बिना login) |

## What you get

- **`fund_research` टूल** — एक फंड कोड अंदर, एक संस्करणित Markdown शोध रिपोर्ट बाहर: अवलोकन, प्रदर्शन विघटन, होल्डिंग्स प्रवेश, सरलीकृत शैली आरोपण, प्रबंधक प्रोफ़ाइल, जोखिम और अंतराल घोषणाएँ, अस्वीकरण, और एक **संख्या-अनुरेखण परिशिष्ट** जो हर प्रमुख आँकड़े को उसके स्नैपशॉट JSON पथ और सत्यापन फैसले से जोड़ता है। `fund-reports/{code}/{YYYYMMDD-HHmmss}/` में `report.md` + `manifest.json` + `snapshot.json` के रूप में सील किया जाता है। `background: true` इसे `fund-report` बैकग्राउंड जॉब के रूप में चलाता है।
- **`fund_snapshot` टूल** — एक हल्का स्नैपशॉट कार्ड (नवीनतम NAV, प्रकाशित चरण रिटर्न, स्केल, प्रबंधक, टॉप-3 होल्डिंग्स) फंड के दिन-निर्देशिका में सील होता है।
- **नियतिवादी मेट्रिक्स, शून्य मॉडल अंकगणित** — अवधि/वार्षिकीकृत रिटर्न, अस्थिरता, अधिकतम ड्रॉडाउन, Sharpe; टॉप-N सांद्रता, HHI, उद्योग वितरण, त्रैमासिक होल्डिंग्स तुलना; आकार-मूल्य शैली बैंड; प्रबंधक कार्यकाल और साथियों से तुलना। सब कुछ सील किए गए स्नैपशॉट पर शुद्ध फ़ंक्शन।
- **अनुरेखण एक प्रथम श्रेणी सुविधा** — सील करने से पहले, हर प्रमुख आँकड़े की सील किए गए `snapshot.json` के विरुद्ध जाँच होती है — वैकल्पिक [`dsh-data-quality`](https://github.com/topics/dsh-plugin) सेवा के माध्यम से जब वह स्थापित हो, अन्यथा अंतर्निहित समरूपी फ़ॉलबैक जाँचकर्ता (`builtin-fallback`) से। परिशिष्ट तालिका मूल्य ↔ पथ ↔ फैसला दर्ज करती है।
- **ईमानदार अंतराल** — एक असफल या अवक्रमित डेटा स्रोत प्रभावित अनुभाग में स्पष्ट 数据缺口 (डेटा अंतराल) घोषणा उत्पन्न करता है। प्लगइन कभी भी किसी अंतराल को गढ़े हुए आँकड़े से नहीं भरता।
- **ऑफ़लाइन मोड** — `offline: true` (config या टूल तर्क) सब कुछ स्टोरेज-डोमेन स्नैपशॉट परत या डिस्क पर नवीनतम संस्करण स्नैपशॉट से परोसता है, शून्य बाहरी अनुरोधों के साथ। परीक्षण और पुनरुत्पादन के लिए आदर्श।
- **सत्र ऑडिट इवेंट** — `fund-research/snapshot` और `fund-research/report` केवल-लॉग इवेंट कोड, संस्करण निर्देशिका, मैनिफ़ेस्ट हैश और अंतराल सूची रखते हैं (मॉडल-दृश्य ⟺ लॉग किया गया)।
- **पद्धति स्किल** — एक बंडलित `fund-research` स्किल मॉडल को मेट्रिक परिभाषाएँ (口径), अंतराल-संचालन और अनुपालन शब्दावली सिखाता है। गणना कोड में ही रहती है।

## Quick start

```text
> 用 fund_research 出一份 161725 的研究报告
```

एजेंट `fund_research({ code: "161725" })` कहता है; कुछ पल बाद workspace में यह होता है:

```text
fund-reports/161725/20260819-153012/
├── snapshot.json    # कच्चे निकाले गए डेटा + गणना मेट्रिक्स + प्रति-स्रोत sha256
├── report.md        # अनुरेखण परिशिष्ट के साथ शोध रिपोर्ट
└── manifest.json    # स्नैपशॉट/रिपोर्ट हैश, पैरामीटर, सत्यापन इंजन, अंतराल
```

`report.md` के परिशिष्ट में हर आँकड़ा `snapshot.json` के विरुद्ध `verified` / `mismatch` / `not-found` / `unverifiable` फैसला रखता है — दस्तावेज़ित口径 के साथ `raw.*` से इनमें से कोई भी पुनर्गणना करके प्लगइन की ही ऑडिट करें।

## Install & uninstall

```sh
dsh plugin --profile web add dsh-fund-research     # स्थापित करें (npm या tarball)
dsh plugin --profile web remove dsh-fund-research  # हटाएँ
```

स्थापित करने के बाद प्रोफ़ाइल पुनः आरंभ करें (बंडल सक्रियण restart-आधारित है)। बंडल पैच स्टोरेज स्टैक (`dsh-storage` + `dsh-storage-json` + `dsh-storage-domain`) को रचता है जिसकी स्नैपशॉट परत को आवश्यकता है।

## Configuration

सभी कुंजियाँ वैकल्पिक हैं (डिफ़ॉल्ट दिखाए गए); अमान्य मान लोड होते समय ज़ोर से विफल होते हैं।

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | मुख्य स्विच; `false` कुछ भी माउंट नहीं करता। |
| `eastmoneyBaseUrl` | `https://fund.eastmoney.com` | Tiantian Fund pingzhongdata होस्ट। |
| `f10BaseUrl` | `https://fundf10.eastmoney.com` | Tiantian Fund F10 होस्ट (होल्डिंग्स + प्रबंधक पृष्ठ)। |
| `quoteBaseUrl` | `https://push2.eastmoney.com` | प्रति-स्टॉक मूल्यांकन स्नैपशॉट हेतु Eastmoney कोट होस्ट। |
| `quoteFallbackBaseUrl` | `https://push2delay.eastmoney.com` | प्राथमिक होस्ट विफल होने पर प्रति-स्टॉक आज़माया जाने वाला वैकल्पिक कोट होस्ट (Eastmoney का अपना विलंबित-कोट होस्ट); `''` इसे बंद करता है। |
| `requestIntervalMs` | `1000` | बाहरी अनुरोधों के बीच न्यूनतम अंतर (विनम्र संग्रह)। |
| `timeoutMs` | `15000` | प्रति-अनुरोध समय-सीमा। |
| `retries` | `2` | एक्सपोनेंशियल बैकऑफ़ के साथ प्रति-अनुरोध पुनर्प्रयास। |
| `cacheTtlHours` | `12` | स्टोरेज-डोमेन स्नैपशॉट पुनःउपयोग विंडो। |
| `riskFreeRate` | `0.02` | Sharpe अनुपात हेतु वार्षिक जोखिम-मुक्त दर। |
| `offline` | `false` | कभी अनुरोध न भेजें; केवल स्नैपशॉट परत पढ़ें। |
| `reportRoot` | `fund-reports` | कार्यक्षेत्र-सापेक्ष (या निरपेक्ष) रिपोर्ट ट्री रूट। |
| `styleQuotes` | `true` | शैली आरोपण हेतु प्रति-स्टॉक मूल्यांकन कोट प्राप्त करें। |

## Tools & surfaces

### `fund_research`

| तर्क | प्रकार | विवरण |
|---|---|---|
| `code` (आवश्यक) | string | छह-अंकीय फंड कोड, उदा. `"161725"`। |
| `sections` | string[] | रेंडर करने के लिए अनुभाग (`overview`/`performance`/`holdings`/`style`/`manager`/`risk`/`disclaimer`)। डिफ़ॉल्ट: सभी। |
| `offline` | boolean | केवल स्नैपशॉट परत पढ़ें (कोई नेटवर्क नहीं)। डिफ़ॉल्ट: प्लगइन config। |
| `background` | boolean | `fund-report` बैकग्राउंड जॉब के रूप में चलाएँ; `{ kind: "background", jobId }` लौटाता है। डिफ़ॉल्ट: `false`। |

### `fund_snapshot`

| तर्क | प्रकार | विवरण |
|---|---|---|
| `code` (आवश्यक) | string | छह-अंकीय फंड कोड। |
| `offline` | boolean | केवल स्नैपशॉट परत पढ़ें। डिफ़ॉल्ट: प्लगइन config। |

### रिपोर्ट अनुभाग

概览 अवलोकन · 业绩拆解 प्रदर्शन विघटन · 持仓穿透 होल्डिंग्स प्रवेश · 风格归因 शैली आरोपण (सरलीकृत) · 经理画像 प्रबंधक प्रोफ़ाइल · 风险与缺口声明 जोखिम और अंतराल · 免责声明 अस्वीकरण · 附录：数字回溯表 अनुरेखण परिशिष्ट।

## Permissions & data

- **पढ़ता है** Tiantian Fund / Eastmoney सार्वजनिक एंडपॉइंट (`fund.eastmoney.com/pingzhongdata/*.js`, `fundf10.eastmoney.com` F10 पृष्ठ, `push2.eastmoney.com` कोट) ब्राउज़र User-Agent और कॉन्फ़िगर करने योग्य विनम्र गति के साथ। बिना key, बिना login, बिना भुगतान API, बिना एंटी-क्रॉलर बाईपास।
- **लिखता है** केवल सत्र workspace के अंदर कॉन्फ़िगर किए गए रिपोर्ट रूट के अंतर्गत, साथ ही `dsh_fund_research` स्टोरेज डोमेन (प्रति फंड नवीनतम स्नैपशॉट)।
- **कभी नहीं** दूरस्थ JavaScript का मूल्यांकन करता (pingzhongdata ब्लॉक स्कैन किया जाता है, कभी निष्पादित नहीं), कभी credentials संग्रहीत नहीं करता, कभी ट्रेड नहीं करता।
- सत्र इवेंट केवल-लॉग ऑडिट रिकॉर्ड हैं; पिन किए गए 0.1.0-rc.8 peers कोई `ignorable` एनवलप प्रदान नहीं करते, इसलिए *इस* प्लगइन के बिना किसी build द्वारा पुनर्स्थापित सत्र उन लॉग पंक्तियों को अस्वीकार करता है — इस परिवार के अन्य शोध प्लगइनों द्वारा स्वीकृत वही व्यापार-बंद।

## Security boundaries

- फंड कोड किसी पथ या URL को छूने से पहले ठीक छह अंकों के रूप में मान्य किए जाते हैं; रिपोर्ट रूट सत्र workspace के अंदर हल होता है।
- स्रोत पेलोड अधिग्रहण पर हैश (SHA-256) किए जाते हैं; सील किया गया मैनिफ़ेस्ट चलानों के बीच मौन अपस्ट्रीम संपादन का पता लगाता है।
- सत्यापन कभी सीलिंग को रोकता नहीं: एक टूटी हुई वैकल्पिक `dsh-data-quality` सेवा अंतर्निहित जाँचकर्ता में अवक्रमित होती है, और उपयोग किया गया इंजन मैनिफ़ेस्ट और परिशिष्ट में दर्ज होता है।
- रिपोर्टिंग नीति के लिए देखें [SECURITY.md](SECURITY.md)।

## Known limitations

- **अपस्ट्रीम संरचना बहाव।** पार्सर डिज़ाइन से सख्त हैं: यदि Tiantian Fund `var Data_*` आकार या F10 तालिका लेआउट बदलता है, तो प्रभावित स्रोत फ़ील्ड का नाम देते हुए `SourceParseError` फेंकता है, और अनुभाग घोषित अंतराल तक अवक्रमित होता है (मुख्य pingzhongdata ब्लॉक की विफलता रन को ज़ोर से रोकती है)। यह जानबूझकर है — मौन गलत पार्सिंग घोषित अंतराल से बदतर है।
- **शैली आरोपण 估算口径 है (अनुमानित)।** निश्चित आकार बैंड (≥1000亿 / 300–1000亿 / <300亿) और PE बैंड, साथ ही होल्डिंग्स के भीतर पंचक — कोई पूर्ण-बाज़ार वितरण परामर्श नहीं लिया जाता। रिपोर्ट इसे लेबल करती है।
- **होल्डिंग्स त्रैमासिक प्रकटीकरण डेटा हैं** (प्रकाशन अंतराल के साथ); F10 पृष्ठ नवीनतम दो तिमाहियों को रखता है।
- **प्रति कॉल एक फंड; कोई पोर्टफोलियो विश्लेषण नहीं, कोई PDF वार्षिक रिपोर्ट नहीं, कोई रीयल-टाइम कोट नहीं** (`fundgz.1234567.com.cn` रीयल-टाइम एंडपॉइंट मृत है और जानबूझकर उपयोग नहीं किया जाता)।
- Web UI की "deliverables" पंक्ति उत्परिवर्तन-टूल कॉल कार्ड से खिलाई जाती है; इस प्लगइन के उत्पादित फ़ाइलें कॉल कार्ड के अनुसरण-स्थान (फंड की रिपोर्ट निर्देशिका) के माध्यम से दिखती हैं, प्रति-फ़ाइल पंक्तियों के रूप में नहीं।

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci   # प्रकार, सहित। CI-सख्त
pnpm test                                     # वास्तविक seams पर 113 परीक्षण
pnpm run test:e2e                              # वैकल्पिक वास्तविक-नेटवर्क E2E (LIVE_E2E=1)
pnpm run build && pnpm run verify:artifacts   # tsdown + tsc घोषणाएँ
pnpm run verify:self-contained                # रिपॉजिटरी के बाहर कोई निर्भरता स्पेक नहीं
node scripts/check-readme-sync.mjs            # पाँच-भाषा README गेट
pnpm pack                                     # tarball
```

परीक्षण 0.1.0-rc.8 peers के वास्तविक `Context`/`SessionStore`/`ToolRuntime`/`LocalJobRegistry`/स्टोरेज seam का उपयोग करते हैं; नेटवर्क केवल fetch सीमा पर सहेजे गए वास्तविक-प्रतिक्रिया फिक्स्चर (`fixtures/`, फंड 161725) द्वारा प्रतिस्थापित होता है। `.tmp/` के कलेक्टर स्क्रिप्ट से फिक्स्चर ताज़ा करें।

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `fund-research` · `mutual-fund` · `investment-research` · `finance` · `research-report`

## Contributors

dsh-fund-research योगदानकर्ताओं द्वारा निर्मित। ऊपर दिए गए रिपॉजिटरी में issues और pull requests स्वागत हैं।

## PerryLink DSH Plugin Family

समान इंजीनियरिंग आधार साझा करने वाले स्टैंडअलोन DeepSeek Harness प्लगइनों के परिवार का हिस्सा: पिन किए गए 0.1.0-rc.8 peers, ज़ोर-विफल Schemastery config, पाँच-भाषा READMEs, और वास्तविक-seam vitest कवरेज।

## License

[Apache-2.0](LICENSE)। तृतीय-पक्ष सूचनाएँ: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)।

**अस्वीकरण: यह प्लगइन केवल शोध कलाकृतियाँ बनाता है। इसका कोई भी आउटपुट निवेश सलाह नहीं है।**