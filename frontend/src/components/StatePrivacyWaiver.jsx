import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LocalStorage } from '../utils/localStorageManager';

// U.S. States with privacy waiver requirements
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington D.C.' }
];

// States with specific privacy requirements
const CCPA_STATES = ['CA']; // California Consumer Privacy Act
const VCDPA_STATES = ['VA']; // Virginia Consumer Data Protection Act
const CPA_STATES = ['CO']; // Colorado Privacy Act
const CTDPA_STATES = ['CT']; // Connecticut Data Privacy Act

const getPrivacyWaiver = (stateCode) => {
  if (CCPA_STATES.includes(stateCode)) {
    return {
      title: 'California Privacy Notice',
      text: `Under the California Consumer Privacy Act (CCPA), you have rights regarding your personal information. Cycle Coach stores all personal data locally on your device - we do not collect, sell, or share your personal information with third parties. Your cycle data never leaves your device.`
    };
  }
  if (VCDPA_STATES.includes(stateCode)) {
    return {
      title: 'Virginia Privacy Notice',
      text: `Under the Virginia Consumer Data Protection Act (VCDPA), you have rights regarding your personal data. Cycle Coach stores all personal data locally on your device - we do not process, sell, or share your personal information. Your cycle data remains private and on your device.`
    };
  }
  if (CPA_STATES.includes(stateCode)) {
    return {
      title: 'Colorado Privacy Notice',
      text: `Under the Colorado Privacy Act (CPA), you have rights regarding your personal data. Cycle Coach stores all personal data locally on your device - we do not collect, sell, or share your personal information. Your cycle data stays on your device.`
    };
  }
  if (CTDPA_STATES.includes(stateCode)) {
    return {
      title: 'Connecticut Privacy Notice',
      text: `Under the Connecticut Data Privacy Act (CTDPA), you have rights regarding your personal data. Cycle Coach stores all personal data locally on your device - we do not process, sell, or share your personal information.`
    };
  }
  // Default waiver for other states
  return {
    title: 'Privacy Notice',
    text: `Cycle Coach respects your privacy. All personal data including cycle information is stored locally on your device. We do not collect, store, or share your personal information on our servers. Your data stays private and under your control.`
  };
};

const StatePrivacyWaiver = ({ onComplete }) => {
  const [location, setLocation] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);

  // Check if user already completed this step
  useEffect(() => {
    const savedLocation = LocalStorage.getUserLocation();
    if (savedLocation) {
      onComplete();
    }
  }, [onComplete]);

  const handleLocationSelect = (value) => {
    setLocation(value);
    setSelectedState('');
    setShowWaiver(false);
    setAcknowledged(false);
  };

  const handleStateSelect = (value) => {
    setSelectedState(value);
    setShowWaiver(true);
  };

  const handleContinue = () => {
    if (location === 'outside_us') {
      LocalStorage.saveUserLocation({ location: 'outside_us', state: null });
      onComplete();
    } else if (location === 'us' && selectedState && acknowledged) {
      LocalStorage.saveUserLocation({ location: 'us', state: selectedState });
      onComplete();
    }
  };

  const waiver = selectedState ? getPrivacyWaiver(selectedState) : null;
  const canContinue = location === 'outside_us' || (location === 'us' && selectedState && acknowledged);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="bg-slate-800/90 border-slate-700 max-w-lg w-full" data-testid="state-privacy-waiver">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">Privacy &amp; Location</CardTitle>
          <CardDescription className="text-slate-400">
            To provide you with relevant privacy information, please tell us where you&apos;re located.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Location Selection */}
          <div>
            <Label className="text-slate-300 text-sm mb-2 block">Where are you located?</Label>
            <Select value={location} onValueChange={handleLocationSelect}>
              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                <SelectValue placeholder="Select your location" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="us" className="text-white">United States</SelectItem>
                <SelectItem value="outside_us" className="text-white">Outside the United States</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* State Selection (US only) */}
          {location === 'us' && (
            <div>
              <Label className="text-slate-300 text-sm mb-2 block">Select your state</Label>
              <Select value={selectedState} onValueChange={handleStateSelect}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-60">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code} className="text-white">
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Privacy Waiver (US states) */}
          {showWaiver && waiver && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">{waiver.title}</h4>
              <p className="text-slate-400 text-sm mb-4">{waiver.text}</p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={setAcknowledged}
                  className="border-slate-500 data-[state=checked]:bg-cyan-500"
                />
                <Label htmlFor="acknowledge" className="text-slate-300 text-sm cursor-pointer">
                  I have read and acknowledge this privacy notice
                </Label>
              </div>
            </div>
          )}

          {/* Outside US message */}
          {location === 'outside_us' && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm">
                Cycle Coach stores all your data locally on your device. We do not collect or store personal information on our servers. Your privacy is protected by our local-first architecture.
              </p>
            </div>
          )}

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
            data-testid="privacy-continue-btn"
          >
            Continue
          </Button>

          <p className="text-xs text-slate-500 text-center">
            This information helps us provide relevant privacy notices. Your location is stored locally and never shared.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatePrivacyWaiver;
