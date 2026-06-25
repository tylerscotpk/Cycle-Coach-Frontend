import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import InfoNav from '@/components/InfoNav';

// Cycle Coach circular icon
const CYCLE_COACH_ICON = "https://customer-assets.emergentagent.com/job_partner-cycle/artifacts/mdtjfodq_Cycle%20Coach%20Circle%20Icon.png";

const InfoHome = () => {
  return (
    <div className="min-h-screen ">
      <InfoNav />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 right-10 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-[400px] h-[400px] bg-slate-700/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Centered Icon */}
          <div className="flex justify-center mb-8">
            <img 
              src={CYCLE_COACH_ICON} 
              alt="Cycle Coach" 
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
            />
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight mb-4" data-testid="hero-headline">
            The Relationship<br />Game-Changer for Men
          </h1>
          
          {/* Teal Subheading */}
          <p className="text-xl sm:text-2xl text-cyan-400 font-light mb-4">
            Understand her cycle. Strengthen your bond.
          </p>
          
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-10">
            Cycle Coach is your daily playbook for understanding the emotional rhythm behind the menstrual cycle — so you can lead with confidence, support her better, and win the relationship.
          </p>
          <Link to="/about">
            <Button 
              size="lg" 
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-10 py-6 text-lg font-semibold rounded-lg"
              data-testid="learn-more-btn"
            >
              Learn More
            </Button>
          </Link>
        </div>
      </section>

      {/* A Smarter Way Section */}
      <section className="py-24 px-6 border-t border-slate-800/50">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 tracking-tight">
            A Better Way to Understand Her
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Admit it; you can't read her mind. But with Cycle Coach, you're one step closer to being able to. Women's emotions are driven by their hormones, which - as you know - change throughout the month. Climb into the driver's seat, champ, because you're about to navigate those changes with precision.
          </p>
        </div>
      </section>

      {/* Built for Men Section */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 tracking-tight">
            Built for Men Who Want to Lead With Awareness
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            This isn't guesswork. It's a predictable pattern. Cycle Coach turns it into a simple, daily guide that helps you stay connected, grounded, and intentional.
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
              data-testid="cta-signup-btn"
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

export default InfoHome;
