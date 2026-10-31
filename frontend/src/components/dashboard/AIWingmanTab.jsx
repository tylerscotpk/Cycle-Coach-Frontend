import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const AIWingmanTab = ({ hasAIAccess, chatHistory, chatMessage, setChatMessage, onSendMessage, onUpgrade, upgrading }) => {
  if (!hasAIAccess) {
    return (
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
        <CardContent className="p-8 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h3 className="text-white text-xl font-bold mb-2">AI Wingman — Advanced Plan</h3>
          <p className="text-slate-400 mb-6">Get personalized, AI-powered relationship advice 24/7. Upgrade to Advanced to unlock your AI Wingman.</p>
          <Button
            onClick={onUpgrade}
            disabled={upgrading}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6"
            data-testid="upgrade-to-advanced-btn"
          >
            {upgrading ? 'Upgrading...' : 'Upgrade to Advanced — $8/mo'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Your AI Wingman</CardTitle>
        <CardDescription className="text-slate-400">Ask questions, get real advice, learn what actually works</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 mb-4 p-4 bg-slate-900/50 rounded-lg" data-testid="chat-history">
          {chatHistory.length === 0 ? (
            <div className="text-slate-400 text-center py-8" data-testid="empty-chat-message">
              What&apos;s up? Ask me anything about your girl. &quot;What should I do when she&apos;s mad?&quot; &quot;How does she like her coffee?&quot; I got you.
            </div>
          ) : (
            <div className="space-y-4">
              {chatHistory.map((conv, idx) => {
                const parts = conv.response.split(/Question:/i);
                const mainResponse = parts[0].trim();
                const question = parts[1]?.trim();

                return (
                  <div key={idx} className="space-y-2">
                    <div className="bg-cyan-500/20 p-3 rounded-lg ml-8" data-testid={`user-message-${idx}`}>
                      <div className="text-xs text-cyan-400 mb-1">You</div>
                      <div className="text-white">{conv.message}</div>
                    </div>
                    <div className="bg-slate-700/50 p-3 rounded-lg mr-8" data-testid={`ai-response-${idx}`}>
                      <div className="text-xs text-cyan-400 mb-1">AI Wingman</div>
                      <div className="text-slate-200 whitespace-pre-line">{mainResponse}</div>
                    </div>
                    {question && (
                      <div className="bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-lg mr-8" data-testid={`ai-question-${idx}`}>
                        <div className="text-xs text-cyan-400 mb-1">💬 Follow-up Question</div>
                        <div className="text-cyan-300 font-medium">{question}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <form onSubmit={onSendMessage} className="flex gap-2">
          <Input
            data-testid="chat-input"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="e.g., 'She's been quiet all day, what do I do?'"
            className="bg-slate-700/50 border-slate-600 text-white"
          />
          <Button type="submit" data-testid="send-message-button" className="bg-cyan-500 hover:bg-cyan-600">
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AIWingmanTab;
