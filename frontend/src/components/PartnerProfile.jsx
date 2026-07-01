import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const DEFAULT_CATEGORIES = [
  {
    id: 'preferences',
    name: 'Preferences',
    fields: [
      { id: 'coffee_order', label: 'Coffee Order', placeholder: 'e.g., Iced oat milk latte, extra shot' },
      { id: 'ice_cream', label: 'Favorite Ice Cream', placeholder: 'e.g., Mint chocolate chip' },
      { id: 'comfort_food', label: 'Comfort Food', placeholder: 'e.g., Pizza, Mac & cheese, Sushi' },
      { id: 'love_language', label: 'Love Language', placeholder: 'e.g., Quality time, Acts of service' },
      { id: 'stressed_preference', label: 'When Stressed, She Wants', placeholder: 'e.g., Space to decompress, Cuddles and talk' },
      { id: 'gift_ideas', label: 'Gift Ideas', placeholder: 'e.g., Books, Candles, Jewelry' },
      { id: 'date_ideas', label: 'Favorite Date Ideas', placeholder: 'e.g., Hiking, Cooking together, Wine tasting' },
    ]
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    fields: [
      { id: 'movie_genre', label: 'Movie Genres', placeholder: 'e.g., Rom-coms, Horror, Drama' },
      { id: 'favorite_movies', label: 'Favorite Movies', placeholder: 'e.g., The Notebook, Inception' },
      { id: 'tv_series', label: 'Favorite TV Series', placeholder: 'e.g., Friends, Stranger Things' },
      { id: 'music_artists', label: 'Favorite Music Artists', placeholder: 'e.g., Taylor Swift, The Weeknd' },
      { id: 'music_genres', label: 'Music Genres', placeholder: 'e.g., Pop, R&B, Indie' },
      { id: 'podcast_shows', label: 'Podcasts She Listens To', placeholder: 'e.g., Crime Junkie, The Daily' },
    ]
  }
];

const PartnerProfile = ({ partner, updatePreference, hasAIAccess }) => {
  const [categories, setCategories] = useState(() => {
    const saved = partner?.preferences?._custom_categories;
    return saved || DEFAULT_CATEGORIES;
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addCategoryName, setAddCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addFieldTarget, setAddFieldTarget] = useState(null);
  const [newFieldLabel, setNewFieldLabel] = useState('');

  const saveCategories = (updated) => {
    setCategories(updated);
    updatePreference('_custom_categories', updated);
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!addCategoryName.trim()) return;
    const id = addCategoryName.trim().toLowerCase().replace(/\s+/g, '_');
    if (categories.find(c => c.id === id)) {
      toast.error('Category already exists');
      return;
    }
    const updated = [...categories, { id, name: addCategoryName.trim(), fields: [] }];
    saveCategories(updated);
    setAddCategoryName('');
    setShowAddCategory(false);
    toast.success(`"${addCategoryName.trim()}" added`);
  };

  const handleDeleteCategory = () => {
    if (!deleteTarget) return;
    const updated = categories.filter(c => c.id !== deleteTarget.id);
    // Also clear preference values for deleted fields
    deleteTarget.fields.forEach(f => updatePreference(f.id, ''));
    saveCategories(updated);
    setDeleteTarget(null);
    toast.success(`"${deleteTarget.name}" deleted`);
  };

  const handleAddField = (e) => {
    e.preventDefault();
    if (!newFieldLabel.trim() || !addFieldTarget) return;
    const fieldId = `${addFieldTarget}_${newFieldLabel.trim().toLowerCase().replace(/\s+/g, '_')}`;
    const updated = categories.map(cat => {
      if (cat.id === addFieldTarget) {
        return {
          ...cat,
          fields: [...cat.fields, { id: fieldId, label: newFieldLabel.trim(), placeholder: `Enter ${newFieldLabel.trim().toLowerCase()}...` }]
        };
      }
      return cat;
    });
    saveCategories(updated);
    setNewFieldLabel('');
    setAddFieldTarget(null);
    toast.success(`Field added`);
  };

  const handleDeleteField = (categoryId, fieldId) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, fields: cat.fields.filter(f => f.id !== fieldId) };
      }
      return cat;
    });
    updatePreference(fieldId, '');
    saveCategories(updated);
  };

  return (
    <>
      <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Partner Profile</CardTitle>
          <CardDescription className="text-slate-400">
            Track her preferences so you never forget what she likes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {categories.map((category) => (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold text-lg">{category.name}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className="text-slate-400 hover:text-cyan-400 text-xs h-7 px-2"
                      onClick={() => setAddFieldTarget(category.id)}
                      data-testid={`add-field-${category.id}`}
                    >
                      + Field
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-slate-500 hover:text-red-400 text-xs h-7 px-2"
                      onClick={() => setDeleteTarget(category)}
                      data-testid={`delete-category-${category.id}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {category.fields.map((field) => (
                  <div key={field.id} className="group relative">
                    <Label htmlFor={field.id} className="text-white text-sm">{field.label}</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id={field.id}
                        data-testid={`${field.id}-input`}
                        placeholder={field.placeholder}
                        defaultValue={partner?.preferences?.[field.id] || ''}
                        onBlur={(e) => updatePreference(field.id, e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white flex-1"
                      />
                      <Button
                        variant="ghost" size="sm"
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity h-9 px-2"
                        onClick={() => handleDeleteField(category.id, field.id)}
                        title="Remove field"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}

                {category.fields.length === 0 && (
                  <p className="text-slate-500 text-sm italic">No fields yet. Click &quot;+ Field&quot; to add one.</p>
                )}
              </div>
            ))}
          </div>

          {/* Add Category */}
          <div className="mt-6 flex flex-wrap gap-3">
            {showAddCategory ? (
              <form onSubmit={handleAddCategory} className="flex gap-2 items-end">
                <Input
                  value={addCategoryName}
                  onChange={(e) => setAddCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="bg-slate-700/50 border-slate-600 text-white w-48"
                  autoFocus
                  data-testid="new-category-input"
                />
                <Button type="submit" size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white" data-testid="save-category-btn">
                  Add
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-slate-400" onClick={() => { setShowAddCategory(false); setAddCategoryName(''); }}>
                  Cancel
                </Button>
              </form>
            ) : (
              <Button
                variant="outline" size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => setShowAddCategory(true)}
                data-testid="add-category-btn"
              >
                + Add Category
              </Button>
            )}
          </div>

          {hasAIAccess && (
            <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-cyan-400 text-sm">
                💡 <strong>Pro Tip:</strong> The AI Wingman uses this info to give you personalized recommendations.
                Ask things like &quot;What movie should we watch tonight?&quot; or &quot;Any new albums she&apos;d like?&quot;
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Field Modal */}
      <AlertDialog open={addFieldTarget !== null} onOpenChange={() => setAddFieldTarget(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Add a new field</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              What do you want to track?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={handleAddField}>
            <Input
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="e.g., Favorite Restaurant, Allergies, Ring Size"
              className="bg-slate-700/50 border-slate-600 text-white mb-4"
              autoFocus
              data-testid="new-field-input"
            />
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-600 text-slate-300">Cancel</AlertDialogCancel>
              <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white" data-testid="save-field-btn">
                Add Field
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-red-300">
              All data within this category will be permanently lost and cannot be recovered. This includes all fields and any values you&apos;ve entered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-delete-category"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PartnerProfile;
