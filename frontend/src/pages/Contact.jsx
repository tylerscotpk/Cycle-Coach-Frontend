import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const Contact = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
          name: formData.name || 'Anonymous',
          email: formData.email,
          message: formData.message
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitted(true);
        toast.success('Message sent successfully!');
        setFormData({ name: '', email: '', message: '' });
      } else {
        toast.error(result.message || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Contact Us</h1>
            <p className="text-slate-400 mt-1">We&apos;d love to hear from you</p>
          </div>
          <Button
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={() => navigate('/')}
            data-testid="back-to-dashboard-btn"
          >
            ← Back
          </Button>
        </div>

        {/* Success State */}
        {submitted ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">✉️</div>
              <h2 className="text-2xl font-bold text-white mb-3">Message Sent!</h2>
              <p className="text-slate-400 mb-6">
                Thank you for reaching out. We&apos;ll get back to you as soon as possible.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                >
                  Send Another Message
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-cyan-500 hover:bg-cyan-600"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Contact Form */
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Send a Message</CardTitle>
              <CardDescription className="text-slate-400">
                Have questions, feedback, or suggestions? Let us know!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">
                    Name <span className="text-slate-500">(optional)</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleChange}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                    data-testid="contact-name-input"
                  />
                </div>

                {/* Email Field (Required) */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Email <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                    data-testid="contact-email-input"
                  />
                </div>

                {/* Message Field (Required) */}
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-slate-300">
                    Message <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="How can we help you?"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                    data-testid="contact-message-input"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  data-testid="contact-submit-btn"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Additional Info */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm text-center">
              We typically respond within 24-48 hours. Your privacy is important to us.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contact;
