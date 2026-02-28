import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const FeedbackModal = ({ isOpen, onClose, feedbackType, email, subscriptionTier }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const getPromptText = () => {
    switch (feedbackType) {
      case 'trial_day7':
        return {
          title: "How's your first week going? 🏆",
          subtitle: "We'd love to hear about your training experience",
          placeholder: "What's been most helpful? What could be better?"
        };
      case 'conversion':
        return {
          title: "Welcome to the team! 🎉",
          subtitle: "Thanks for upgrading - we'd love your thoughts",
          placeholder: "What made you decide to upgrade? Any features you're excited about?"
        };
      case 'cancellation':
        return {
          title: "We're sorry to see you go 😔",
          subtitle: "Help us understand what we could do better",
          placeholder: "What was the main reason for cancelling? How can we improve?"
        };
      default:
        return {
          title: "Share your feedback",
          subtitle: "Help us make Cycle Coach better",
          placeholder: "What do you think?"
        };
    }
  };

  const promptText = getPromptText();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API}/api/feedback/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          rating,
          feedback_text: feedbackText.trim() || null,
          feedback_type: feedbackType,
          subscription_tier: subscriptionTier
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        setSubmitted(true);
        toast.success('Thank you for your feedback! 🙏');
        
        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        toast.error('Failed to submit feedback. Please try again.');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast.error('Unable to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Record that user skipped (still useful data)
    onClose();
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-4">🙏</div>
            <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
            <p className="text-slate-400">Your feedback helps us improve Cycle Coach for everyone.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-slate-800 border-slate-700 max-w-md w-full" data-testid="feedback-modal">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-white">{promptText.title}</CardTitle>
          <CardDescription className="text-slate-400">{promptText.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Star Rating */}
          <div className="text-center">
            <p className="text-slate-300 text-sm mb-3">How would you rate Cycle Coach?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="text-3xl transition-transform hover:scale-110"
                  data-testid={`star-${star}`}
                >
                  {star <= (hoveredRating || rating) ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-cyan-400 text-sm mt-2">
                {rating === 5 && "Excellent! 🎉"}
                {rating === 4 && "Great! 😊"}
                {rating === 3 && "Good 👍"}
                {rating === 2 && "Could be better 🤔"}
                {rating === 1 && "We'll do better 💪"}
              </p>
            )}
          </div>

          {/* Text Feedback */}
          <div>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={promptText.placeholder}
              className="bg-slate-700/50 border-slate-600 text-white min-h-[100px]"
              data-testid="feedback-text"
            />
            <p className="text-slate-500 text-xs mt-1">Optional - but we read every response!</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleSkip}
              className="flex-1 border-slate-600 text-slate-400 hover:bg-slate-700"
              data-testid="skip-feedback-btn"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || rating === 0}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
              data-testid="submit-feedback-btn"
            >
              {isSubmitting ? 'Sending...' : 'Submit Feedback'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackModal;
