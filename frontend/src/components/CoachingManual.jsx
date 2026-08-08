import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const MANUAL_DATA = [
  {
    category: "Hormones",
    terms: [
      {
        term: "Estrogen",
        definition: "The main hormone driving the first half of the cycle. Rises through the follicular phase, peaks right before ovulation, then drops. Higher estrogen generally means more energy, better mood, and more social interest."
      },
      {
        term: "FSH (Follicle-Stimulating Hormone)",
        definition: "Released by the brain to kick off egg development each cycle. It\u2019s the signal that starts the follicular phase \u2014 think of it as the \u201Copening whistle.\u201D"
      },
      {
        term: "LH (Luteinizing Hormone)",
        definition: "Surges right before ovulation and triggers the release of the egg. The \u201CLH surge\u201D is what ovulation predictor kits actually test for."
      },
      {
        term: "Progesterone",
        definition: "Rises after ovulation during the luteal phase to prepare the body in case of pregnancy. If pregnancy doesn\u2019t happen, progesterone (and estrogen) drop sharply right before the period starts \u2014 that drop is what causes most PMS symptoms."
      },
      {
        term: "Testosterone",
        definition: "Present in smaller amounts throughout the cycle, with a slight rise around ovulation. Linked to increased confidence and libido during that window."
      },
    ]
  },
  {
    category: "Cycle Phases",
    terms: [
      {
        term: "Cycle Length",
        definition: "The full length of one cycle, counted from the first day of one period to the first day of the next. \u201CAverage\u201D is often cited as 28 days, but anywhere from about 21\u201335 days is considered normal \u2014 cycle length varies person to person."
      },
      {
        term: "Follicular Phase (Days 6\u201313, roughly)",
        definition: "Starts the day after the period ends and runs until ovulation. Estrogen climbs steadily, energy comes back online, and this is generally the highest-energy stretch of the cycle."
      },
      {
        term: "Luteal Phase (Days 17\u201323, roughly)",
        definition: "The stretch after ovulation and before the period. Progesterone rises first, then everything drops toward the end of the phase \u2014 that drop is the PMS window."
      },
      {
        term: "Menstrual Phase (Days 1\u20135, roughly)",
        definition: "The period itself \u2014 when the uterine lining sheds. Estrogen and progesterone are at their lowest point of the cycle, which is why energy often dips here."
      },
      {
        term: "Ovulation (Days 14\u201316, roughly)",
        definition: "The release of an egg from the ovary, triggered by the LH surge. Estrogen and testosterone both peak around this time."
      },
      {
        term: "PMS (Premenstrual Syndrome)",
        definition: "The final few days of the luteal phase, right before the period starts. Caused by the sharp drop in estrogen and progesterone \u2014 not a mood choice or a personality shift."
      },
    ]
  },
  {
    category: "General Terms",
    terms: [
      {
        term: "Basal Body Temperature (BBT)",
        definition: "Body temperature at rest, taken first thing in the morning. Rises slightly after ovulation due to the increase in progesterone \u2014 some people track it to help identify their fertile window."
      },
      {
        term: "Cycle Syncing",
        definition: "The general idea of adjusting plans, expectations, or activities based on which phase of the cycle someone is in \u2014 the core concept behind this app."
      },
      {
        term: "Dysmenorrhea",
        definition: "The medical term for period cramps. Common and usually manageable, but severe or worsening cramps are worth mentioning to a doctor."
      },
      {
        term: "Fertile Window",
        definition: "The several days each cycle when pregnancy is possible \u2014 generally the few days leading up to and including ovulation."
      },
      {
        term: "Mittelschmerz",
        definition: "A mild, one-sided pelvic twinge some people feel around ovulation, caused by the egg release. German for \u201Cmiddle pain\u201D \u2014 it\u2019s normal, not a cause for concern."
      },
      {
        term: "PMDD (Premenstrual Dysphoric Disorder)",
        definition: "A more severe form of PMS involving significant mood symptoms that interfere with daily life. Less common than typical PMS and worth a conversation with a doctor if symptoms seem to go beyond what\u2019s usual."
      },
    ]
  }
];

const CoachingManual = () => {
  const [openTerm, setOpenTerm] = useState(null);
  const [heights, setHeights] = useState({});
  const contentRefs = useRef({});

  const measureHeight = useCallback((key, el) => {
    if (el) {
      contentRefs.current[key] = el;
      const h = el.scrollHeight;
      setHeights(prev => prev[key] !== h ? { ...prev, [key]: h } : prev);
    }
  }, []);

  // Re-measure when openTerm changes
  useEffect(() => {
    if (openTerm && contentRefs.current[openTerm]) {
      setHeights(prev => ({ ...prev, [openTerm]: contentRefs.current[openTerm].scrollHeight }));
    }
  }, [openTerm]);

  const handleToggle = (key) => {
    const newKey = openTerm === key ? null : key;
    setOpenTerm(newKey);

    // Scroll into view if expanding
    if (newKey) {
      setTimeout(() => {
        const el = document.querySelector(`[data-term-key="${newKey}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  };

  const categoryIcons = {
    "Hormones": "text-pink-400",
    "Cycle Phases": "text-cyan-400",
    "General Terms": "text-amber-400",
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700" data-testid="coaching-manual">
      <CardHeader>
        <CardTitle className="text-white">Coaching Manual</CardTitle>
        <CardDescription className="text-slate-400">
          Key terms and concepts to help you understand her cycle
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {MANUAL_DATA.map((section) => (
          <div key={section.category}>
            <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${categoryIcons[section.category]}`}>
              {section.category}
            </h3>
            <div className="space-y-1">
              {section.terms.map((item) => {
                const key = `${section.category}-${item.term}`;
                const isOpen = openTerm === key;
                return (
                  <div
                    key={key}
                    data-term-key={key}
                    className="rounded-lg overflow-hidden border border-slate-700/50"
                    data-testid={`manual-term-${item.term.toLowerCase().replace(/[\s()]/g, '-')}`}
                  >
                    <button
                      onClick={() => handleToggle(key)}
                      className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                        isOpen ? 'bg-slate-700/60' : 'bg-slate-800/30 hover:bg-slate-700/30'
                      }`}
                      data-testid={`manual-btn-${item.term.toLowerCase().replace(/[\s()]/g, '-')}`}
                    >
                      <span className={`text-sm font-medium ${isOpen ? 'text-white' : 'text-slate-300'}`}>
                        {item.term}
                      </span>
                      <svg
                        className={`w-4 h-4 flex-shrink-0 ml-2 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div
                      style={{ maxHeight: isOpen ? `${heights[key] || 200}px` : '0px' }}
                      className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
                    >
                      <div
                        ref={(el) => measureHeight(key, el)}
                        className="px-3 pb-3 pt-1"
                      >
                        <p className="text-slate-400 text-sm leading-relaxed">{item.definition}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CoachingManual;
