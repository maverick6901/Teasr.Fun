import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Lock, Check, AlertCircle, RefreshCw, MessageCircle, DollarSign } from 'lucide-react';
import { PostWithCreator } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ethers } from 'ethers';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostWithCreator;
  onSuccess: () => void;
  paymentType?: 'content' | 'comment'; // New prop to determine what we're unlocking
}

export function PaymentModal({ isOpen, onClose, post, onSuccess, paymentType = 'content' }: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('USDC');
  const [isBuyout, setIsBuyout] = useState(false);
  const [showMessagePrompt, setShowMessagePrompt] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const acceptedCryptos = post.acceptedCryptos.split(',');
  const isCommentUnlock = paymentType === 'comment';

  // Check if buyout is full (10 investors)
  const isBuyoutFull = (post.investorCount || 0) >= 10;

  // Fetch live crypto prices
  const { data: prices } = useQuery({
    queryKey: ['/api/prices'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate price in selected cryptocurrency
  const getConvertedPrice = (usdPrice: string) => {
    if (!prices || selectedCrypto === 'USDC') {
      return parseFloat(usdPrice);
    }

    const usdAmount = parseFloat(usdPrice);
    const cryptoPrice = prices[selectedCrypto as keyof typeof prices] || 1;
    return parseFloat((usdAmount / cryptoPrice).toFixed(6));
  };

  // Use comment fee if unlocking comments, otherwise use post price
  const basePrice = isCommentUnlock ? (post.commentFee || '0') : post.price;
  
  // Only use buyout price if:
  // 1. Not unlocking comments
  // 2. Buyout price exists
  // 3. Investor spots not full
  // 4. User selected buyout option
  const shouldUseBuyoutPrice = !isCommentUnlock && post.buyoutPrice && !isBuyoutFull && isBuyout;
  const finalPrice = shouldUseBuyoutPrice ? post.buyoutPrice : basePrice;
  
  const convertedPrice = getConvertedPrice(finalPrice);

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      const walletAddress = (window as any).walletAddress;

      if (!walletAddress) {
        throw new Error('Please connect your wallet first');
      }

      // Get the network based on selected cryptocurrency
      const getNetwork = (crypto: string) => {
        switch (crypto) {
          case 'SOL': return 'solana-devnet';
          case 'ETH': return 'ethereum-sepolia';
          case 'MATIC': return 'polygon-mumbai';
          case 'BNB': return 'bsc-testnet';
          default: return 'base-sepolia';
        }
      };

      const network = getNetwork(selectedCrypto);
      
      // Create payment transaction signature
      let transactionHash = '';
      
      if (typeof window.ethereum !== 'undefined' && selectedCrypto !== 'SOL') {
        // For EVM chains (ETH, MATIC, BNB, Base/USDC)
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          
          // Get payment amount in wei
          const usdPrice = isCommentUnlock 
            ? (post.commentFee || '0')
            : (isBuyout && post.buyoutPrice ? post.buyoutPrice : post.price);
          const paymentAmount = selectedCrypto === 'USDC'
            ? usdPrice
            : (isBuyout && convertedBuyoutPrice ? convertedBuyoutPrice : convertedPrice).toString();
          
          // For testnet, we'll create a simple signed message as proof of payment intent
          const message = `Pay ${paymentAmount} ${selectedCrypto} for post ${post.id} on ${network}`;
          const signature = await signer.signMessage(message);
          
          // In production, this would be an actual on-chain transaction
          transactionHash = signature;
          
          toast({
            title: 'Transaction Signed',
            description: `Payment of ${paymentAmount} ${selectedCrypto} signed successfully`,
          });
        } catch (signError: any) {
          console.error('Signing error:', signError);
          throw new Error('Failed to sign transaction. Please try again.');
        }
      } else {
        // For Solana or mock transaction
        transactionHash = '0x' + Math.random().toString(16).substring(2, 66);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Calculate payment amount in selected cryptocurrency
      const shouldUseBuyoutForPayment = !isCommentUnlock && isBuyout && !isBuyoutFull && post.buyoutPrice;
      const usdPrice = isCommentUnlock 
        ? (post.commentFee || '0')
        : (shouldUseBuyoutForPayment ? post.buyoutPrice : post.price);
      const cryptoPrice = getConvertedPrice(usdPrice);
      const paymentAmount = selectedCrypto === 'USDC' ? usdPrice : cryptoPrice.toString();
      
      console.log('Payment details:', { usdPrice, cryptoPrice, paymentAmount, selectedCrypto, isBuyout, isBuyoutFull });

      // Use different endpoint for comment unlock
      const endpoint = isCommentUnlock 
        ? `/api/posts/${post.id}/pay-comment`
        : `/api/posts/${post.id}/pay`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({
          amount: paymentAmount,
          cryptocurrency: selectedCrypto,
          network: network,
          isBuyout: isCommentUnlock ? false : isBuyout,
          transactionHash: transactionHash,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Payment failed');
      }

      const result = await response.json();

      setPaymentComplete(true);

      if (!result.alreadyPaid) {
        // Show message prompt for content payments, immediate success for comments
        if (!isCommentUnlock) {
          setTimeout(() => {
            setShowMessagePrompt(true);
          }, 1000);
        } else {
          toast({
            title: 'Comments unlocked!',
            description: 'You can now view and participate in the discussion',
          });
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        }
      } else {
        toast({
          title: 'Already unlocked!',
          description: isCommentUnlock ? 'Comments already unlocked. Enjoy!' : 'Content unlocked. Enjoy!',
        });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoToMessages = () => {
    setShowMessagePrompt(false);
    onSuccess();
    onClose();
    setLocation('/messages');
  };

  const handleSkip = () => {
    setShowMessagePrompt(false);
    onSuccess();
    onClose();
  };

  return (
    <>
      {/* Message Prompt Dialog */}
      <Dialog open={showMessagePrompt} onOpenChange={setShowMessagePrompt}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display flex items-center gap-2">
              <Check className="w-6 h-6 text-green-500" />
              Payment Successful!
            </DialogTitle>
            <DialogDescription>
              Would you like to message the creator?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <MessageCircle className="w-10 h-10 text-primary" />
              <div>
                <p className="font-semibold">Message @{post.creator.username}</p>
                <p className="text-sm text-muted-foreground">
                  Start a conversation about this content
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleGoToMessages}
              size="lg"
              className="w-full"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Go to Messages
            </Button>
            <Button
              onClick={handleSkip}
              variant="ghost"
              size="lg"
              className="w-full"
            >
              Skip for now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {isCommentUnlock ? 'Unlock Comments' : 'Unlock Content'}
          </DialogTitle>
          <DialogDescription>
            {isCommentUnlock 
              ? 'Pay to access comments and join the discussion'
              : 'Pay with USDC to reveal and access this content'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Content Preview or Comment Icon */}
          {isCommentUnlock ? (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                  <MessageCircle className="w-10 h-10 text-primary" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Locked Comments</p>
              </div>
            </div>
          ) : (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={post.blurredThumbnailPath}
                alt={post.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 backdrop-blur-xl bg-black/40 flex items-center justify-center">
                <div className="text-center text-white">
                  <Lock className="w-12 h-12 mx-auto mb-3 opacity-80" />
                  <p className="text-sm font-medium">Locked Content</p>
                </div>
              </div>
            </div>
          )}

          {/* Post Info */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg" data-testid="text-payment-title">{post.title}</h3>
              {post.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {post.description}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between py-3 border-t border-b border-border">
              <span className="text-sm font-medium">Creator</span>
              <Badge variant="secondary" data-testid="badge-creator">
                {post.creator.username}
              </Badge>
            </div>

            {/* Crypto Selection */}
            {acceptedCryptos.length > 1 && (
              <div className="space-y-2">
                <Label>Select Cryptocurrency</Label>
                <div className="grid grid-cols-2 gap-2">
                  {acceptedCryptos.map((crypto) => (
                    <Button
                      key={crypto}
                      variant={selectedCrypto === crypto ? "default" : "outline"}
                      onClick={() => setSelectedCrypto(crypto)}
                      className="w-full"
                    >
                      {crypto}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Buyout Option - only for content, not comments, and only if spots available */}
            {!isCommentUnlock && post.buyoutPrice && !isBuyoutFull && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="buyout">
                    Investor Option
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Become 1 of 10 investors and earn $0.05 from every future unlock
                  </p>
                </div>
                <Switch
                  id="buyout"
                  checked={isBuyout}
                  onCheckedChange={setIsBuyout}
                />
              </div>
            )}

            {/* Show message when investor spots are full */}
            {!isCommentUnlock && isBuyoutFull && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  All 10 investor spots filled!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Unlocking at regular price. Your payment helps the 10 investors earn $0.05 each.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Price in {selectedCrypto}</span>
                <div className="flex items-center space-x-2">
                  {prices && selectedCrypto !== 'USDC' && (
                    <RefreshCw className="w-3 h-3 text-muted-foreground" />
                  )}
                  <Badge className="bg-primary text-primary-foreground text-lg px-4 py-1 font-bold" data-testid="badge-payment-price">
                    {`${convertedPrice.toFixed(selectedCrypto === 'USDC' ? 2 : 6)} ${selectedCrypto}`}
                  </Badge>
                </div>
              </div>
              {selectedCrypto !== 'USDC' && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>≈ ${finalPrice} USD</span>
                  {prices && typeof prices[selectedCrypto as keyof typeof prices] === 'number' && (
                    <span>1 {selectedCrypto} = ${prices[selectedCrypto as keyof typeof prices].toFixed(2)}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment Status */}
          {paymentComplete && (
            <div className="flex items-center space-x-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">Payment confirmed! Unlocking...</span>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start space-x-2 p-4 bg-muted rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This is a prototype. In production, payments would use the x402 protocol with on-chain USDC transfers via MetaMask.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={isProcessing || paymentComplete}
            data-testid="button-payment-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            className="flex-1"
            disabled={isProcessing || paymentComplete}
            data-testid="button-confirm-payment"
          >
            <Lock className="w-4 h-4 mr-2" />
            {isProcessing ? 'Processing...' : paymentComplete ? 'Unlocked!' : 'Pay & Unlock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}