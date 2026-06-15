import "../styles/emergent.css";

export default function Landing() {
  return (
    <div className="container">
      <div className="nav">
        <div className="brand">CycleCoach</div>
        <div className="navlinks">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#signup">Sign Up</a>
          <a href="#contact">Contact</a>
        </div>
      </div>

      <div id="home" className="hero">
        <h1 className="h1">The Relationship Game-Changer for Men</h1>
        <p className="sub">
          Cycle Coach gives you the emotional pattern behind the menstrual cycle so you can communicate better,
          support smarter, and stay in sync.
        </p>

        <div className="ctaRow">
          <a className="btn btnPrimary" href="/app">Enter App</a>
          <a className="btn" href="#inside">See What’s Inside</a>
        </div>

        <div className="pills">
          <div className="pill">MoodMap</div>
          <div className="pill">Phase Predictor</div>
          <div className="pill">Partner Profile</div>
          <div className="pill">AI Wingman (coming soon)</div>
          <div className="pill">Resources</div>
        </div>
      </div>

      <div id="about" className="section">
        <h2 className="sectionTitle">A Better Way to Understand Her</h2>
        <div className="split">
          <div className="panel">
            <div className="kicker">Why this matters</div>
            <p className="big">
              Most couples don’t struggle because they’re incompatible. They struggle because they’re unsynced.
              Cycle Coach gives you a clear, coach-like framework for understanding the emotional rhythm behind the cycle —
              so you can show up with the right energy at the right time.
            </p>
          </div>

          <div className="panel">
            <div className="kicker">Built for men</div>
            <p className="big">
              This isn’t guesswork. It’s a predictable pattern. Cycle Coach turns it into a simple, daily guide that helps
              you stay connected, grounded, and intentional.
            </p>
          </div>
        </div>
      </div>

      <div id="inside" className="section">
        <h2 className="sectionTitle">Inside the App</h2>
        <div className="grid">
          <div className="card">
            <p className="cardTitle">MoodMap</p>
            <p className="cardBody">Visual cycle tracking with emotional insights.</p>
          </div>

          <div className="card">
            <p className="cardTitle">Phase Predictor</p>
            <p className="cardBody">Know what’s coming before it arrives.</p>
          </div>

          <div className="card">
            <p className="cardTitle">Partner Profile</p>
            <p className="cardBody">Preferences, do’s/don’ts, reminders — all in one place.</p>
          </div>

          <div className="card">
            <p className="cardTitle">AI Wingman</p>
            <p className="cardBody">Context-aware suggestions (coming soon).</p>
          </div>

          <div className="card">
            <p className="cardTitle">Resources</p>
            <p className="cardBody">Bite-sized guidance and articles.</p>
          </div>

          <div className="card">
            <p className="cardTitle">Log Period Starts</p>
            <p className="cardBody">Quick logging to keep predictions accurate.</p>
          </div>
        </div>
      </div>

      <div id="signup" className="section">
        <h2 className="sectionTitle">Sign Up</h2>
        <div className="panel">
          <div className="kicker">Private beta</div>
          <p className="big">
            Want early access? For now, enter the app and validate your license. Public signup is coming soon.
          </p>
          <div className="ctaRow">
            <a className="btn btnPrimary" href="/app">Go to App</a>
          </div>
        </div>
      </div>

      <div id="contact" className="section">
        <h2 className="sectionTitle">Contact</h2>
        <div className="panel">
          <p className="big">
            Questions or feedback? Drop your contact method here later (email link, form, etc.).
          </p>
        </div>
      </div>

      <div className="footer">
        Beta build • Not medical advice • Built to help partners show up better
      </div>
    </div>
  );
}