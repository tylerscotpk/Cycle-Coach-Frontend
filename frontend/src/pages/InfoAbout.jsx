import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import InfoNav from '@/components/InfoNav';

const InfoAbout = () => {
  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 left-20 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-8" data-testid="about-headline">
            What Is Cycle Coach?
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Cycle Coach is a relationship performance tool that teaches you the emotional and energetic pattern behind the menstrual cycle. It gives you a strategic, coach-like way to understand timing, communication, and support — without confusion or mixed signals.
          </p>
        </div>
      </section>

      {/* Why It Works Section */}
      <section className="py-20 px-6 border-t border-slate-800/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 tracking-tight">
            Why It Works
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            The menstrual cycle follows a consistent rhythm that results in predictable emotional patterns. Once you understand that rhythm, everything becomes clearer: conversations, planning, intimacy, and conflict. Cycle Coach breaks the pattern down into simple, actionable insights you can use every day.
          </p>
        </div>
      </section>

      {/* Direct Approach Section */}
      <section className="py-20 px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 tracking-tight">
            A Direct, Practical Approach
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            No fluff. No over-explaining. Just a clean, masculine, high-performance framework that helps you show up as a more aware, more grounded partner.
          </p>
        </div>
      </section>

      {/* App Preview Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-16 text-center tracking-tight">
            Inside the App
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* MoodMap */}
            <div className="text-center">
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-4 aspect-[9/16] flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex flex-col items-center justify-center p-4">
                  <div className="text-6xl mb-4">🎯</div>
                  <div className="text-white font-semibold text-lg mb-2">MoodMap</div>
                  <div className="text-slate-400 text-sm text-center">Visual cycle tracking with emotional insights</div>
                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {[...Array(28)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-3 h-3 rounded-full ${
                          i < 5 ? 'bg-red-500/60' : 
                          i < 13 ? 'bg-green-500/60' : 
                          i < 16 ? 'bg-pink-500/60' : 
                          i < 23 ? 'bg-blue-500/60' : 'bg-orange-500/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <h3 className="text-white font-semibold text-lg">MoodMap</h3>
            </div>

            {/* Phase Predictor */}
            <div className="text-center">
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-4 aspect-[9/16] flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex flex-col items-center justify-center p-4">
                  <div className="text-6xl mb-4">📅</div>
                  <div className="text-white font-semibold text-lg mb-2">Phase Predictor</div>
                  <div className="text-slate-400 text-sm text-center">Know what's coming before it arrives</div>
                  <div className="mt-4 space-y-2 w-full">
                    <div className="bg-cyan-500/20 rounded-lg p-2 text-cyan-400 text-xs">Day 14 • Ovulation</div>
                    <div className="bg-purple-500/20 rounded-lg p-2 text-purple-400 text-xs">Day 17 • Early Luteal</div>
                    <div className="bg-orange-500/20 rounded-lg p-2 text-orange-400 text-xs">Day 24 • PMS</div>
                  </div>
                </div>
              </div>
              <h3 className="text-white font-semibold text-lg">Phase Predictor</h3>
            </div>

            {/* Resources */}
            <div className="text-center">
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-4 aspect-[9/16] flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex flex-col items-center justify-center p-4">
                  <div className="text-6xl mb-4">📚</div>
                  <div className="text-white font-semibold text-lg mb-2">Resources</div>
                  <div className="text-slate-400 text-sm text-center">Phase-specific guidance and articles</div>
                  <div className="mt-4 space-y-2 w-full">
                    <div className="bg-slate-700/50 rounded-lg p-2 text-slate-300 text-xs text-left">📖 Understanding Her Energy</div>
                    <div className="bg-slate-700/50 rounded-lg p-2 text-slate-300 text-xs text-left">💡 Communication Tips</div>
                    <div className="bg-slate-700/50 rounded-lg p-2 text-slate-300 text-xs text-left">🎯 Date Night Ideas</div>
                  </div>
                </div>
              </div>
              <h3 className="text-white font-semibold text-lg">Resources</h3>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-slate-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 tracking-tight">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-slate-400 mb-10">
            Choose a plan and start training your relationship today.
          </p>
          <Link to="/signup">
            <Button 
              size="lg" 
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-10 py-6 text-lg font-semibold rounded-lg"
              data-testid="about-signup-btn"
            >
              View Plans
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800/50">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Stars & Honey, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default InfoAbout;
