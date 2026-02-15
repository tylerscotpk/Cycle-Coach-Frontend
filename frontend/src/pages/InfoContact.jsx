import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import InfoNav from '@/components/InfoNav';

const API = process.env.REACT_APP_BACKEND_URL;

const InfoContact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.message) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    
    try {
      const response = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name || 'Not provided',
          email: formData.email,
          message: formData.message,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitted(true);
        setFormData({ name: '', email: '', message: '' });
      } else {
        toast.error(result.message || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Contact form error:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <InfoNav />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-40 left-20 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6" data-testid="contact-headline">
            Get in Touch
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Have a question or need support? Send us a message and we'll get back to you as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 px-6">
        <div className="max-w-xl mx-auto">
          {submitted ? (
            <Card className="bg-slate-900/80 border-slate-700/50">
              <CardContent className="py-16 text-center">
                <div className="text-5xl mb-6">✓</div>
                <h2 className="text-2xl font-bold text-white mb-4">Message Sent</h2>
                <p className="text-slate-400 text-lg">
                  Thanks — your message has been sent. We'll respond shortly.
                </p>
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="mt-8 border-slate-600 text-slate-300 hover:bg-slate-800"
                  data-testid="send-another-btn"
                >
                  Send Another Message
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900/80 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white text-xl">Contact Form</CardTitle>
                <CardDescription className="text-slate-400">
                  Fill out the form below and we'll get back to you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Name <span className="text-slate-500">(optional)</span>
                    </label>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      data-testid="contact-name-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      data-testid="contact-email-input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Message <span className="text-red-400">*</span>
                    </label>
                    <Textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="How can we help?"
                      required
                      rows={5}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                      data-testid="contact-message-input"
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-6 text-lg font-semibold"
                    data-testid="contact-submit-btn"
                  >
                    {submitting ? 'Sending...' : 'Send Message'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-800/50 mt-auto">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Stars & Honey, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default InfoContact;
