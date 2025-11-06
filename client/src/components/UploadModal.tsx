import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Upload, Image as ImageIcon, X, Users, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0.50');
  const [isFree, setIsFree] = useState(false);
  const [buyoutPrice, setBuyoutPrice] = useState('');
  const [maxInvestors, setMaxInvestors] = useState(10);
  const [investorRevenueShare, setInvestorRevenueShare] = useState('0');
  const [acceptedCryptos, setAcceptedCryptos] = useState<string[]>(['USDC']);
  const [commentsLocked, setCommentsLocked] = useState(false);
  const [commentFee, setCommentFee] = useState('0.10');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image or video file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'File size must be less than 50MB',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || !title) {
      toast({
        title: 'Missing information',
        description: 'Please add a file and title',
        variant: 'destructive',
      });
      return;
    }

    if (!isFree && (!price || parseFloat(price) <= 0)) {
      toast({
        title: 'Invalid price',
        description: 'Price must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    if (acceptedCryptos.length === 0 && !isFree) {
      toast({
        title: 'Missing information',
        description: 'Please select at least one accepted cryptocurrency',
        variant: 'destructive',
      });
      return;
    }

    const walletAddress = (window as any).walletAddress || localStorage.getItem('walletAddress');
    if (!walletAddress) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to upload',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('price', isFree ? '0' : price);
      formData.append('isFree', isFree.toString());
      if (buyoutPrice && parseFloat(buyoutPrice) > 0) {
        formData.append('buyoutPrice', buyoutPrice);
      }
      formData.append('maxInvestors', maxInvestors.toString());
      formData.append('investorRevenueShare', investorRevenueShare);
      formData.append('acceptedCryptos', acceptedCryptos.join(','));
      formData.append('commentsLocked', commentsLocked.toString());
      if (commentsLocked && commentFee) {
        formData.append('commentFee', commentFee);
      }

      const response = await fetch('/api/posts/upload', {
        method: 'POST',
        headers: {
          'x-wallet-address': walletAddress,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(data.error || 'Upload failed');
      }

      const data = await response.json();

      toast({
        title: 'Upload successful!',
        description: 'Your content has been encrypted and published',
      });

      // Reset form
      setFile(null);
      setPreview(null);
      setTitle('');
      setDescription('');
      setPrice('0.50');
      setIsFree(false);
      setBuyoutPrice('');
      setMaxInvestors(10);
      setInvestorRevenueShare('0');
      setAcceptedCryptos(['USDC']);
      setCommentsLocked(false);
      setCommentFee('0.10');

      // Call callbacks after a short delay to ensure state is updated
      setTimeout(() => {
        onUploadSuccess();
        onClose();
      }, 100);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setTitle('');
    setDescription('');
    setPrice('0.50');
    setIsFree(false);
    setBuyoutPrice('');
    setMaxInvestors(10);
    setInvestorRevenueShare('0');
    setAcceptedCryptos(['USDC']);
    setCommentsLocked(false);
    setCommentFee('0.10');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetForm();
        onClose();
      }
    }}>
      {/* DialogContent is made scrollable with max-h and overflow-y-auto */}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-display">Upload Content</DialogTitle>
          <DialogDescription className="text-sm">
            Upload an image or video, set your price, and start earning USDC
          </DialogDescription>
        </DialogHeader>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4 sm:space-y-6 py-4"
        >
          {/* File Upload Area */}
          <div>
            <Label>Media File *</Label>
            {!file ? (
              <motion.div
                onClick={() => fileInputRef.current?.click()}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="mt-2 border-2 border-dashed border-border rounded-xl p-8 sm:p-12 text-center cursor-pointer hover-elevate active-elevate-2 transition-all touch-manipulation"
                data-testid="dropzone-upload"
              >
                <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  Images or videos (max 50MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file"
                />
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-2 relative rounded-xl overflow-hidden bg-muted"
              >
                <AnimatePresence>
                  {preview && (
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      src={preview}
                      alt="Preview"
                      className="w-full aspect-video object-cover"
                      data-testid="img-preview"
                    />
                  )}
                </AnimatePresence>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 hover-elevate active-elevate-2"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  data-testid="button-remove-file"
                >
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm sm:text-base">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your content a catchy title"
              className="mt-2 touch-manipulation min-h-10"
              data-testid="input-title"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm sm:text-base">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this content worth unlocking?"
              className="mt-2 resize-none touch-manipulation"
              rows={3}
              data-testid="textarea-description"
            />
          </div>

          {/* Free Content Toggle */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="space-y-0.5">
              <Label htmlFor="is-free">Make Content Free</Label>
              <p className="text-sm text-muted-foreground">
                Allow everyone to access without payment
              </p>
            </div>
            <Switch
              id="is-free"
              checked={isFree}
              onCheckedChange={setIsFree}
              data-testid="switch-is-free"
            />
          </div>

          {/* Price */}
          {!isFree && (
            <div>
              <Label htmlFor="price">Unlock Price (USD Equivalent) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-2 touch-manipulation min-h-10"
                data-testid="input-price"
              />
            </div>
          )}

          {/* Buyout Price */}
          {!isFree && (
            <div>
              <Label htmlFor="buyout-price">Buyout Price (Optional)</Label>
              <Input
                id="buyout-price"
                type="number"
                step="0.01"
                min="0.01"
                value={buyoutPrice}
                onChange={(e) => setBuyoutPrice(e.target.value)}
                placeholder="Set a one-time full ownership price"
                className="mt-2 touch-manipulation min-h-10"
                data-testid="input-buyout-price"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Users can pay this price to permanently own the content
              </p>
            </div>
          )}

          {/* Investor Settings */}
          {!isFree && buyoutPrice && parseFloat(buyoutPrice) > 0 && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-primary">
                <Users className="w-5 h-5" />
                <h3 className="font-semibold">Investor Settings</h3>
              </div>
              
              {/* Max Investors */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="max-investors">Maximum Investors</Label>
                  <span className="text-sm font-medium text-primary">{maxInvestors}</span>
                </div>
                <Slider
                  id="max-investors"
                  min={1}
                  max={100}
                  step={1}
                  value={[maxInvestors]}
                  onValueChange={(value) => setMaxInvestors(value[0])}
                  className="mt-2"
                  data-testid="slider-max-investors"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Set how many investors can buy into your content (1-100)
                </p>
              </div>

              {/* Investor Revenue Share */}
              <div>
                <Label htmlFor="investor-revenue-share" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Investor Revenue Share (%)
                </Label>
                <Input
                  id="investor-revenue-share"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={investorRevenueShare}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val >= 0 && val <= 100) {
                      setInvestorRevenueShare(e.target.value);
                    }
                  }}
                  placeholder="0.00"
                  className="mt-2 touch-manipulation min-h-10"
                  data-testid="input-investor-revenue-share"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Percentage of each unlock fee that goes to investors (0-100%). You keep the rest after platform fees.
                </p>
              </div>
            </div>
          )}

          {/* Accepted Cryptocurrencies */}
          {!isFree && (
            <div>
              <Label>Accepted Cryptocurrencies</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {['USDC', 'SOL', 'ETH', 'MATIC', 'BNB', 'BASE'].map((crypto) => (
                  <div key={crypto} className="flex items-center space-x-2">
                    <Checkbox
                      id={`crypto-${crypto}`}
                      checked={acceptedCryptos.includes(crypto)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAcceptedCryptos([...acceptedCryptos, crypto]);
                        } else {
                          setAcceptedCryptos(acceptedCryptos.filter(c => c !== crypto));
                        }
                      }}
                      data-testid={`checkbox-crypto-${crypto}`}
                    />
                    <Label htmlFor={`crypto-${crypto}`} className="cursor-pointer">
                      {crypto}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Settings */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="comments-locked">Lock Comments</Label>
                <p className="text-sm text-muted-foreground">
                  Require payment to view and post comments
                </p>
              </div>
              <Switch
                id="comments-locked"
                checked={commentsLocked}
                onCheckedChange={setCommentsLocked}
                data-testid="switch-comments-locked"
              />
            </div>

            {commentsLocked && (
              <div>
                <Label htmlFor="comment-fee">Comment Access Fee (USDC)</Label>
                <Input
                  id="comment-fee"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={commentFee}
                  onChange={(e) => setCommentFee(e.target.value)}
                  className="mt-2 touch-manipulation min-h-10"
                  data-testid="input-comment-fee"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isUploading}
            className="hover-elevate active-elevate-2 w-full sm:w-auto min-h-10"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || !file || !title || (!isFree && (!price || parseFloat(price) <= 0))}
            className="hover-elevate active-elevate-2 w-full sm:w-auto min-h-10"
            data-testid="button-publish"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Publish'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}