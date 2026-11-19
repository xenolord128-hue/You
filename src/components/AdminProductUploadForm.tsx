import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Film,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Category,
  Collection,
  Product,
  ProductCategory,
  ProductColor,
  ProductStatus,
} from '../types/ecommerce';

const FALLBACK_CATEGORIES: ProductCategory[] = [
  'T-Shirt',
  'Polo Shirt',
  'Shirt',
  'Hoodie',
  'Jacket',
  'Jeans',
  'Sneakers',
  'Watches',
  'Accessories',
];

const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const PRESET_COLORS: ProductColor[] = [
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#F7F7F6' },
  { name: 'Navy', hex: '#14213D' },
  { name: 'Red', hex: '#B91C1C' },
  { name: 'Charcoal', hex: '#3A3A3D' },
  { name: 'Olive', hex: '#4B5320' },
  { name: 'Sand', hex: '#C8B08E' },
];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const ALLOWED_VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

interface MediaImageEntry {
  id: string;
  url: string;
  file?: File;
  objectUrl?: string;
  name: string;
  sizeBytes?: number;
  status: 'uploaded' | 'pending' | 'uploading' | 'error';
  progress: number;
  error?: string;
}

interface MediaVideoEntry {
  url: string;
  file?: File;
  objectUrl?: string;
  name: string;
  sizeBytes?: number;
  status: 'uploaded' | 'pending' | 'uploading' | 'error';
  progress: number;
  error?: string;
}

interface FormErrors {
  name?: string;
  sizes?: string;
  colors?: string;
  description?: string;
  images?: string;
  video?: string;
  price?: string;
  salePrice?: string;
  category?: string;
  sku?: string;
  inventory?: string;
  submit?: string;
}

const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string; hint: string }[] = [
  { value: 'Published', label: 'Published', hint: 'Live & visible on public website' },
  { value: 'Draft', label: 'Draft', hint: 'Hidden — work in progress' },
  { value: 'Unpublished', label: 'Unpublished', hint: 'Hidden from public storefront' },
  { value: 'Out of Stock', label: 'Out of Stock', hint: 'Hidden until restocked' },
];

interface AdminProductUploadFormProps {
  categories: Category[];
  collections: Collection[];
  adminSessionToken: string;
  editingProduct: Product | null;
  onCancelEdit: () => void;
  upsertProduct: (product: Product, isNew?: boolean) => Promise<Product>;
  showToast: (msg: string) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadMediaWithProgress(
  file: File,
  kind: 'image' | 'video',
  adminSessionToken: string,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const endpoint = `/api/admin/upload-media?kind=${encodeURIComponent(
      kind
    )}&filename=${encodeURIComponent(file.name)}`;

    xhr.open('POST', endpoint, true);
    xhr.withCredentials = true;
    if (adminSessionToken) {
      xhr.setRequestHeader('x-admin-session', adminSessionToken);
    }
    xhr.setRequestHeader(
      'Content-Type',
      file.type || (kind === 'image' ? 'image/jpeg' : 'video/mp4')
    );

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        onProgress(Math.min(99, Math.round((evt.loaded / evt.total) * 100)));
      }
    };

    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        onProgress(100);
        resolve(data.url);
      } else {
        reject(new Error(data.error || `Failed to upload ${kind} (${xhr.status}).`));
      }
    };

    xhr.onerror = () => {
      reject(new Error(`Network error while uploading ${file.name}.`));
    };

    xhr.onabort = () => {
      reject(new Error(`Upload cancelled for ${file.name}.`));
    };

    xhr.send(file);
  });
}

function buildInitialSku(): string {
  return `PW-MN-${Math.floor(100 + Math.random() * 899)}`;
}

export const AdminProductUploadForm: React.FC<AdminProductUploadFormProps> = ({
  categories,
  collections,
  adminSessionToken,
  editingProduct,
  onCancelEdit,
  upsertProduct,
  showToast,
}) => {
  const defaultCategoryName =
    categories[0]?.name || FALLBACK_CATEGORIES[0];

  // PRODUCT INFORMATION
  const [name, setName] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [selectedColors, setSelectedColors] = useState<ProductColor[]>([
    { name: 'Black', hex: '#111111' },
  ]);
  const [customColorName, setCustomColorName] = useState('');
  const [customColorHex, setCustomColorHex] = useState('#111111');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // PRODUCT MEDIA
  const [images, setImages] = useState<MediaImageEntry[]>([]);
  const [primaryImageId, setPrimaryImageId] = useState<string>('');
  const [imageDropActive, setImageDropActive] = useState(false);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [video, setVideo] = useState<MediaVideoEntry | null>(null);
  const [videoDropActive, setVideoDropActive] = useState(false);

  // STOREFRONT PRICING, CATEGORY, TAGS & STATUS DETAILS
  const [sku, setSku] = useState<string>(() => buildInitialSku());
  const [category, setCategory] = useState<ProductCategory>(defaultCategoryName);
  const [subcategory, setSubcategory] = useState('');
  const [collection, setCollection] = useState<string>(
    collections[0]?.slug || 'urban-essentials'
  );
  const [price, setPrice] = useState('1490');
  const [salePrice, setSalePrice] = useState('');
  const [inventory, setInventory] = useState('40');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<ProductStatus>('Published');
  const [materials, setMaterials] = useState('100% Combed Ring-Spun Cotton (260 GSM)');
  const [care, setCare] = useState('Machine wash cold inside out; hang dry.');
  const [sizeFit, setSizeFit] = useState('Tailored modern cut. Take your true size.');
  const [newArrival, setNewArrival] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [isSale, setIsSale] = useState(false);
  const [bestSeller, setBestSeller] = useState(false);
  const [trending, setTrending] = useState(false);
  const [winterCollection, setWinterCollection] = useState(false);

  // STATUS & VALIDATION
  const [errors, setErrors] = useState<FormErrors>({});
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState('');
  const [submitProgress, setSubmitProgress] = useState(0);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<MediaImageEntry[]>([]);
  const videoRef = useRef<MediaVideoEntry | null>(null);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    videoRef.current = video;
  }, [video]);

  // Revoke any remaining blob URLs on unmount
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => {
        if (img.objectUrl) URL.revokeObjectURL(img.objectUrl);
      });
      if (videoRef.current?.objectUrl) {
        URL.revokeObjectURL(videoRef.current.objectUrl);
      }
    };
  }, []);

  const clearForm = (preserveSuccessBanner = false) => {
    imagesRef.current.forEach((img) => {
      if (img.objectUrl) URL.revokeObjectURL(img.objectUrl);
    });
    if (videoRef.current?.objectUrl) {
      URL.revokeObjectURL(videoRef.current.objectUrl);
    }

    setName('');
    setSelectedSizes(['S', 'M', 'L', 'XL']);
    setCustomSizeInput('');
    setSelectedColors([{ name: 'Black', hex: '#111111' }]);
    setCustomColorName('');
    setCustomColorHex('#111111');
    setShortDescription('');
    setDescription('');
    setImages([]);
    setPrimaryImageId('');
    setVideo(null);
    setSku(buildInitialSku());
    setCategory(categories[0]?.name || FALLBACK_CATEGORIES[0]);
    setSubcategory('');
    setCollection(collections[0]?.slug || 'urban-essentials');
    setPrice('1490');
    setSalePrice('');
    setInventory('40');
    setTags([]);
    setTagInput('');
    setStatus('Published');
    setMaterials('100% Combed Ring-Spun Cotton (260 GSM)');
    setCare('Machine wash cold inside out; hang dry.');
    setSizeFit('Tailored modern cut. Take your true size.');
    setNewArrival(true);
    setFeatured(false);
    setIsSale(false);
    setBestSeller(false);
    setTrending(false);
    setWinterCollection(false);
    setErrors({});
    setSubmitStatusText('');
    setSubmitProgress(0);
    if (!preserveSuccessBanner) setSuccessBanner(null);
  };

  // Populate form when editing an existing product or resetting back to Add mode
  useEffect(() => {
    imagesRef.current.forEach((img) => {
      if (img.objectUrl) URL.revokeObjectURL(img.objectUrl);
    });
    if (videoRef.current?.objectUrl) {
      URL.revokeObjectURL(videoRef.current.objectUrl);
    }

    if (!editingProduct) {
      setName('');
      setSelectedSizes(['S', 'M', 'L', 'XL']);
      setCustomSizeInput('');
      setSelectedColors([{ name: 'Black', hex: '#111111' }]);
      setCustomColorName('');
      setCustomColorHex('#111111');
      setShortDescription('');
      setDescription('');
      setImages([]);
      setPrimaryImageId('');
      setVideo(null);
      setSku(buildInitialSku());
      setCategory(categories[0]?.name || FALLBACK_CATEGORIES[0]);
      setSubcategory('');
      setCollection(collections[0]?.slug || 'urban-essentials');
      setPrice('1490');
      setSalePrice('');
      setInventory('40');
      setTags([]);
      setTagInput('');
      setStatus('Published');
      setMaterials('100% Combed Ring-Spun Cotton (260 GSM)');
      setCare('Machine wash cold inside out; hang dry.');
      setSizeFit('Tailored modern cut. Take your true size.');
      setNewArrival(true);
      setFeatured(false);
      setIsSale(false);
      setBestSeller(false);
      setTrending(false);
      setWinterCollection(false);
      setErrors({});
      return;
    }

    setSuccessBanner(null);
    setErrors({});
    setName(editingProduct.name || '');
    setSelectedSizes(
      Array.isArray(editingProduct.sizes) && editingProduct.sizes.length > 0
        ? editingProduct.sizes
        : ['M', 'L']
    );
    setSelectedColors(
      Array.isArray(editingProduct.colors) && editingProduct.colors.length > 0
        ? editingProduct.colors
        : [{ name: 'Black', hex: '#111111' }]
    );
    setShortDescription(editingProduct.shortDescription || '');
    setDescription(editingProduct.description || '');

    const rawImages = (editingProduct.images || []).filter(Boolean);
    const orderedUrls = editingProduct.primaryImage && rawImages.includes(editingProduct.primaryImage)
      ? [
          editingProduct.primaryImage,
          ...rawImages.filter((u) => u !== editingProduct.primaryImage),
        ]
      : rawImages;

    const loadedImages: MediaImageEntry[] = orderedUrls.map((url, idx) => ({
      id: `existing-${idx}-${Date.now()}`,
      url,
      name: url.split('/').pop() || `Product Image ${idx + 1}`,
      status: 'uploaded',
      progress: 100,
    }));
    setImages(loadedImages);
    setPrimaryImageId(loadedImages[0]?.id || '');

    if (editingProduct.videoUrl) {
      setVideo({
        url: editingProduct.videoUrl,
        name: editingProduct.videoUrl.split('/').pop() || 'Product Video',
        status: 'uploaded',
        progress: 100,
      });
    } else {
      setVideo(null);
    }

    setSku(editingProduct.sku || buildInitialSku());
    setCategory(editingProduct.category || categories[0]?.name || FALLBACK_CATEGORIES[0]);
    setSubcategory(editingProduct.subcategory || '');
    setCollection(editingProduct.collection || collections[0]?.slug || 'urban-essentials');

    const hasDiscount = Boolean(
      editingProduct.compare_at_price &&
        editingProduct.compare_at_price > editingProduct.price
    );
    setPrice(
      hasDiscount
        ? String(editingProduct.compare_at_price)
        : String(editingProduct.price ?? 1490)
    );
    setSalePrice(hasDiscount ? String(editingProduct.price) : '');
    setInventory(String(editingProduct.inventory ?? 0));
    setTags(Array.isArray(editingProduct.tags) ? editingProduct.tags : []);
    setTagInput('');
    setStatus(editingProduct.status || 'Draft');
    setMaterials(editingProduct.materials || '');
    setCare(editingProduct.care_instructions || '');
    setSizeFit(editingProduct.size_fit || '');
    setNewArrival(Boolean(editingProduct.new_arrival));
    setFeatured(Boolean(editingProduct.featured));
    setIsSale(Boolean(editingProduct.sale || hasDiscount));
    setBestSeller(Boolean(editingProduct.best_seller));
    setTrending(Boolean(editingProduct.trending));
    setWinterCollection(Boolean(editingProduct.winter_collection));
  }, [editingProduct, collections, categories]);

  // --- SIZE HANDLERS ---
  const toggleSize = (size: string) => {
    setErrors((prev) => ({ ...prev, sizes: undefined }));
    setSuccessBanner(null);
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleAddCustomSize = () => {
    const clean = customSizeInput.trim().toUpperCase();
    if (!clean) return;
    setErrors((prev) => ({ ...prev, sizes: undefined }));
    setSuccessBanner(null);
    setSelectedSizes((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setCustomSizeInput('');
  };

  // --- COLOR HANDLERS ---
  const togglePresetColor = (color: ProductColor) => {
    setErrors((prev) => ({ ...prev, colors: undefined }));
    setSuccessBanner(null);
    setSelectedColors((prev) => {
      const exists = prev.some(
        (c) => c.name.toLowerCase() === color.name.toLowerCase()
      );
      if (exists) {
        return prev.filter((c) => c.name.toLowerCase() !== color.name.toLowerCase());
      }
      return [...prev, color];
    });
  };

  const handleAddCustomColor = () => {
    const cleanName = customColorName.trim();
    if (!cleanName) {
      setErrors((prev) => ({
        ...prev,
        colors: 'Enter a color name (e.g. Forest Green) before adding.',
      }));
      return;
    }
    setErrors((prev) => ({ ...prev, colors: undefined }));
    setSuccessBanner(null);
    setSelectedColors((prev) => {
      const filtered = prev.filter(
        (c) => c.name.toLowerCase() !== cleanName.toLowerCase()
      );
      return [...filtered, { name: cleanName, hex: customColorHex || '#111111' }];
    });
    setCustomColorName('');
  };

  const removeColor = (colorName: string) => {
    setSelectedColors((prev) => prev.filter((c) => c.name !== colorName));
  };

  // --- IMAGE HANDLERS ---
  const appendImageFiles = (filesList: FileList | File[]) => {
    const incoming = Array.from(filesList);
    if (incoming.length === 0) return;

    const accepted: MediaImageEntry[] = [];
    const rejectedMessages: string[] = [];

    incoming.forEach((file) => {
      const validType =
        ALLOWED_IMAGE_MIME.has(file.type.toLowerCase()) ||
        ALLOWED_IMAGE_EXT.test(file.name);
      if (!validType) {
        rejectedMessages.push(`${file.name}: use JPG, JPEG, PNG, or WEBP.`);
        return;
      }
      if (file.size <= 0) {
        rejectedMessages.push(`${file.name}: file is empty.`);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejectedMessages.push(`${file.name}: exceeds 10 MB limit.`);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      accepted.push({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url: objectUrl,
        objectUrl,
        file,
        name: file.name,
        sizeBytes: file.size,
        status: 'pending',
        progress: 0,
      });
    });

    if (rejectedMessages.length > 0) {
      setErrors((prev) => ({ ...prev, images: rejectedMessages.join(' ') }));
    } else {
      setErrors((prev) => ({ ...prev, images: undefined }));
    }

    if (accepted.length > 0) {
      setSuccessBanner(null);
      setImages((prev) => {
        const next = [...prev, ...accepted];
        if (!primaryImageId || !next.some((i) => i.id === primaryImageId)) {
          setPrimaryImageId(next[0].id);
        }
        return next;
      });
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.objectUrl) URL.revokeObjectURL(target.objectUrl);
      const next = prev.filter((i) => i.id !== id);
      if (primaryImageId === id) {
        setPrimaryImageId(next[0]?.id || '');
      }
      return next;
    });
  };

  const setAsPrimaryImage = (id: string) => {
    setPrimaryImageId(id);
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (!target) return prev;
      return [target, ...prev.filter((i) => i.id !== id)];
    });
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((prev) => {
      const nextIdx = index + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, moved);
      return copy;
    });
  };

  const reorderImageById = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setImages((prev) => {
      const fromIndex = prev.findIndex((i) => i.id === fromId);
      const toIndex = prev.findIndex((i) => i.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  // --- VIDEO HANDLERS ---
  const handleSelectVideoFile = (file: File | undefined) => {
    if (!file) return;
    const validType =
      ALLOWED_VIDEO_MIME.has(file.type.toLowerCase()) ||
      ALLOWED_VIDEO_EXT.test(file.name);
    if (!validType) {
      setErrors((prev) => ({
        ...prev,
        video: `${file.name}: unsupported format. Allowed: MP4, WEBM, MOV.`,
      }));
      return;
    }
    if (file.size <= 0) {
      setErrors((prev) => ({ ...prev, video: 'Selected video file is empty.' }));
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setErrors((prev) => ({
        ...prev,
        video: `${file.name} (${formatBytes(file.size)}) exceeds the 50 MB limit.`,
      }));
      return;
    }

    if (videoRef.current?.objectUrl) {
      URL.revokeObjectURL(videoRef.current.objectUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setErrors((prev) => ({ ...prev, video: undefined }));
    setSuccessBanner(null);
    setVideo({
      url: objectUrl,
      objectUrl,
      file,
      name: file.name,
      sizeBytes: file.size,
      status: 'pending',
      progress: 0,
    });
  };

  const handleRemoveVideo = () => {
    if (video?.objectUrl) URL.revokeObjectURL(video.objectUrl);
    setVideo(null);
    setErrors((prev) => ({ ...prev, video: undefined }));
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // --- DRAFT COPY HELPER ---
  const handleGenerateCopy = async () => {
    if (!name.trim()) {
      setErrors((prev) => ({
        ...prev,
        name: 'Enter Product Name first before drafting copy.',
      }));
      return;
    }
    setIsGeneratingCopy(true);
    try {
      const res = await fetch('/api/admin/generate-copy', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(adminSessionToken ? { 'x-admin-session': adminSessionToken } : {}),
        },
        body: JSON.stringify({ name: name.trim(), category, materials }),
      });
      const data = (await res.json()) as { description?: string; sizeFit?: string };
      if (data.description) {
        setDescription(data.description);
        setErrors((prev) => ({ ...prev, description: undefined }));
      }
      if (data.sizeFit) setSizeFit(data.sizeFit);
      showToast('Draft written from name, category and material');
    } catch {
      showToast('Unable to generate copy right now.');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  // --- TAG HANDLERS ---
  const addTagValue = (raw: string) => {
    const cleaned = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (cleaned.length === 0) return;
    setTags((prev) => Array.from(new Set([...prev, ...cleaned])));
    setTagInput('');
  };

  const removeTagValue = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  // --- VALIDATION & SUBMISSION ---
  const validateForm = (): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Product Name is required.';
    if (selectedSizes.length === 0)
      next.sizes = 'Select or add at least one available size.';
    if (selectedColors.length === 0)
      next.colors = 'Select or add at least one available color.';
    if (!description.trim())
      next.description = 'Product Description is required.';
    if (images.length === 0)
      next.images = 'Upload at least one product image (JPG, PNG, or WEBP).';
    if (!sku.trim()) next.sku = 'SKU / Product ID is required.';
    if (!category.trim()) next.category = 'Product Category is required.';

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      next.price = 'Enter a valid regular price greater than 0.';
    }

    if (salePrice.trim()) {
      const numericSale = Number(salePrice);
      if (!Number.isFinite(numericSale) || numericSale <= 0) {
        next.salePrice = 'Discount price must be greater than 0.';
      } else if (Number.isFinite(numericPrice) && numericSale >= numericPrice) {
        next.salePrice = 'Discount price must be lower than regular price.';
      }
    }

    const numericInventory = Number(inventory);
    if (!Number.isFinite(numericInventory) || numericInventory < 0) {
      next.inventory = 'Stock quantity must be 0 or higher.';
    }

    return next;
  };

  const submitWithStatus = async (targetStatus: ProductStatus) => {
    if (isSubmitting) return;

    setSuccessBanner(null);
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors({
        ...validationErrors,
        submit: 'Please fix the highlighted fields before saving the product.',
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    setSubmitProgress(5);

    try {
      // 1. Upload any pending local image files sequentially with progress tracking
      const currentImages = [...images];
      const pendingImageCount = currentImages.filter((i) => i.file && i.status !== 'uploaded').length;
      const hasPendingVideo = Boolean(video?.file && video.status !== 'uploaded');
      const totalSteps = pendingImageCount + (hasPendingVideo ? 1 : 0) + 1;
      let completedSteps = 0;

      const uploadedImages: MediaImageEntry[] = [];
      for (let idx = 0; idx < currentImages.length; idx += 1) {
        const item = currentImages[idx];
        if (!item.file || item.status === 'uploaded') {
          uploadedImages.push(item);
          continue;
        }

        setSubmitStatusText(
          `Uploading image ${uploadedImages.filter((x) => x.file).length + 1} of ${pendingImageCount} (${item.name})...`
        );

        setImages((prev) =>
          prev.map((img) =>
            img.id === item.id ? { ...img, status: 'uploading', error: undefined } : img
          )
        );

        try {
          const uploadedUrl = await uploadMediaWithProgress(
            item.file,
            'image',
            adminSessionToken,
            (pct) => {
              setImages((prev) =>
                prev.map((img) =>
                  img.id === item.id ? { ...img, progress: pct } : img
                )
              );
              const overall = Math.round(
                ((completedSteps + pct / 100) / totalSteps) * 90 + 5
              );
              setSubmitProgress(overall);
            }
          );

          if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
          const finalized: MediaImageEntry = {
            ...item,
            url: uploadedUrl,
            file: undefined,
            objectUrl: undefined,
            status: 'uploaded',
            progress: 100,
            error: undefined,
          };
          uploadedImages.push(finalized);
          setImages((prev) =>
            prev.map((img) => (img.id === item.id ? finalized : img))
          );
          completedSteps += 1;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : `Failed to upload ${item.name}.`;
          setImages((prev) =>
            prev.map((img) =>
              img.id === item.id ? { ...img, status: 'error', error: message } : img
            )
          );
          throw new Error(message);
        }
      }

      // 2. Upload pending product video (if provided)
      let finalVideoUrl: string | undefined = video?.url || undefined;
      if (video?.file && video.status !== 'uploaded') {
        const videoFile = video.file;
        setSubmitStatusText(`Uploading product video (${videoFile.name})...`);
        setVideo((prev) =>
          prev ? { ...prev, status: 'uploading', error: undefined } : prev
        );

        try {
          const uploadedVideoUrl = await uploadMediaWithProgress(
            videoFile,
            'video',
            adminSessionToken,
            (pct) => {
              setVideo((prev) => (prev ? { ...prev, progress: pct } : prev));
              const overall = Math.round(
                ((completedSteps + pct / 100) / totalSteps) * 90 + 5
              );
              setSubmitProgress(overall);
            }
          );

          if (video.objectUrl) URL.revokeObjectURL(video.objectUrl);
          finalVideoUrl = uploadedVideoUrl;
          setVideo({
            url: uploadedVideoUrl,
            name: videoFile.name,
            sizeBytes: videoFile.size,
            status: 'uploaded',
            progress: 100,
          });
          completedSteps += 1;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Failed to upload product video.';
          setVideo((prev) =>
            prev ? { ...prev, status: 'error', error: message } : prev
          );
          throw new Error(message);
        }
      }

      // 3. Construct ordered images + primaryImage and save full product
      const validUrls = uploadedImages
        .map((img) => img.url.trim())
        .filter((url) => Boolean(url) && !url.startsWith('blob:'));

      if (validUrls.length === 0) {
        throw new Error('No uploaded product images were found. Please retry.');
      }

      const primaryEntry =
        uploadedImages.find((img) => img.id === primaryImageId) || uploadedImages[0];
      const primaryImage = primaryEntry.url;
      const orderedImageUrls = [
        primaryImage,
        ...validUrls.filter((u) => u !== primaryImage),
      ];

      setSubmitStatusText('Saving product details to store...');
      setSubmitProgress(96);

      const numericRegular = Number(price) || 0;
      const numericSale = salePrice.trim() ? Number(salePrice) : 0;
      const hasValidDiscount = numericSale > 0 && numericSale < numericRegular;
      const finalSellingPrice = hasValidDiscount ? numericSale : numericRegular;
      const finalCompareAtPrice = hasValidDiscount ? numericRegular : null;
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const nowIso = new Date().toISOString();
      const payload: Product = {
        id: editingProduct?.id || `prod-${Date.now()}`,
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        slug: editingProduct?.slug || slug || `product-${Date.now()}`,
        shortDescription: shortDescription.trim() || undefined,
        description: description.trim(),
        category: category.trim(),
        subcategory: subcategory.trim() || undefined,
        collection,
        price: finalSellingPrice,
        compare_at_price: finalCompareAtPrice,
        images: orderedImageUrls,
        primaryImage,
        ...(finalVideoUrl ? { videoUrl: finalVideoUrl } : {}),
        colors: selectedColors,
        sizes: selectedSizes,
        inventory: Math.max(0, Number(inventory) || 0),
        variantStock: editingProduct?.variantStock,
        tags,
        status: targetStatus,
        rating: editingProduct?.rating || 4.8,
        reviews_count: editingProduct?.reviews_count || 0,
        featured,
        new_arrival: newArrival,
        best_seller: bestSeller,
        trending,
        winter_collection: winterCollection,
        sale: Boolean(hasValidDiscount || isSale),
        materials: materials.trim() || '100% Combed Cotton',
        size_fit: sizeFit.trim() || 'Tailored modern cut. Take your true size.',
        care_instructions: care.trim() || 'Cold gentle wash recommended.',
        features: editingProduct?.features || ['Pre-shrunk fabric', 'Reinforced seams'],
        created_at: editingProduct?.created_at || nowIso,
        updated_at: nowIso,
      };

      const saved = await upsertProduct(payload, !editingProduct);
      setSubmitProgress(100);
      setSubmitStatusText('');

      if (editingProduct) {
        onCancelEdit();
        setSuccessBanner(
          `"${saved.name}" updated (${saved.status}).`
        );
      } else {
        clearForm(true);
        setSuccessBanner(
          `"${saved.name}" saved as ${saved.status} with ${saved.images.length} image${
            saved.images.length === 1 ? '' : 's'
          }${saved.videoUrl ? ' and 1 video' : ''}.${
            saved.status === 'Published'
              ? ' It is now live on the public storefront.'
              : ' It remains hidden from the public storefront until published.'
          }`
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to save product. Please review your connection and try again.';
      setErrors((prev) => ({ ...prev, submit: msg }));
      setSubmitStatusText('');
      setSubmitProgress(0);
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitWithStatus(status);
  };

  const badgeToggleItems = [
    { label: 'Featured Product', on: featured, toggle: () => setFeatured((v) => !v) },
    { label: 'New Arrival', on: newArrival, toggle: () => setNewArrival((v) => !v) },
    { label: 'Sale Product', on: isSale, toggle: () => setIsSale((v) => !v) },
    { label: 'Best Seller', on: bestSeller, toggle: () => setBestSeller((v) => !v) },
    { label: 'Trending', on: trending, toggle: () => setTrending((v) => !v) },
    {
      label: 'Winter Collection',
      on: winterCollection,
      toggle: () => setWinterCollection((v) => !v),
    },
  ];

  const allDisplaySizes = Array.from(new Set([...PRESET_SIZES, ...selectedSizes]));

  const categoryOptionNames = Array.from(
    new Set([
      ...(categories.length > 0
        ? categories.map((c) => c.name)
        : FALLBACK_CATEGORIES),
      ...(category ? [category] : []),
    ])
  );

  const activeCategoryObj = categories.find(
    (c) =>
      c.name.toLowerCase() === category.toLowerCase() ||
      c.filterCategories?.some((fc) => fc.toLowerCase() === category.toLowerCase())
  );

  const subcategorySuggestions = Array.from(
    new Set([
      ...(activeCategoryObj?.subcategories || []),
      ...(activeCategoryObj?.filterCategories || []),
    ])
  ).filter(Boolean);

  const numericRegularPreview = Number(price) || 0;
  const numericSalePreview = salePrice.trim() ? Number(salePrice) : 0;
  const discountPreviewPct =
    numericSalePreview > 0 &&
    numericRegularPreview > 0 &&
    numericSalePreview < numericRegularPreview
      ? Math.round(
          ((numericRegularPreview - numericSalePreview) / numericRegularPreview) * 100
        )
      : 0;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="flex flex-col gap-[22px]"
    >
      {/* Top Studio Header Bar */}
      <div className="admin-card p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[20px]">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h2>
            <span className="admin-pill bg-[#0A0A0A] text-white">
              {editingProduct ? editingProduct.sku : 'New Listing'}
            </span>
          </div>
          <span className="admin-sub">
            {editingProduct
              ? `Updating "${editingProduct.name}". Set status to Published to make it live on the public storefront.`
              : 'Create a product and set status to Published to display it on the public storefront.'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {editingProduct ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancelEdit}
              className="admin-btn admin-btn-sm"
            >
              Cancel Edit
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => clearForm(false)}
              className="admin-btn admin-btn-sm"
            >
              Reset Form
            </button>
          )}
        </div>
      </div>

      {/* Success & Submit Error Banners */}
      {successBanner && (
        <div
          role="status"
          className="admin-card px-5 py-4 !bg-[#0A0A0A] text-white !border-[#0A0A0A] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-[13px] font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="Dismiss notification"
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errors.submit && (
        <div
          role="alert"
          className="admin-card px-5 py-4 !border-[#991B1B] !bg-[#FEF2F2] text-[#7F1D1D] flex items-start gap-2.5 text-[13px]"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">Unable to complete upload</span>
            <span>{errors.submit}</span>
          </div>
        </div>
      )}

      {/* ==================== SECTION 1: PRODUCT INFORMATION ==================== */}
      <section className="admin-card p-5 sm:p-6 flex flex-col gap-5">
        <div className="border-b border-[#ECECEB] pb-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="admin-lbl">Section 01</span>
            <h3 className="text-[18px] mt-0.5">Product Information</h3>
          </div>
          <span className="admin-sub">Core title, sizing, colors &amp; editorial description</span>
        </div>

        {/* 1. Product Name */}
        <div className="admin-fld">
          <label className="admin-lbl" htmlFor="upload-prod-name">
            Product Name <span className="text-[#B91C1C]">*</span>
          </label>
          <input
            id="upload-prod-name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSuccessBanner(null);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Heavyweight Architectural Boxy Tee"
            className={`admin-inp h-[44px] text-[14px] ${
              errors.name ? '!border-[#B91C1C]' : ''
            }`}
          />
          {errors.name && (
            <span className="text-[12px] text-[#B91C1C] font-medium">{errors.name}</span>
          )}
        </div>

        {/* 2. Product Size (Available Sizes) */}
        <div className="admin-fld">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="admin-lbl">
              Available Sizes <span className="text-[#B91C1C]">*</span>
            </label>
            <span className="admin-sub">
              {selectedSizes.length} selected — click to toggle or add a custom size
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {allDisplaySizes.map((sz) => {
              const active = selectedSizes.includes(sz);
              const isCustom = !PRESET_SIZES.includes(sz);
              return (
                <button
                  key={sz}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSize(sz)}
                  className="h-9 px-4 rounded-[9px] text-[12px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                  style={{
                    backgroundColor: active ? '#0A0A0A' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#0A0A0A',
                    border: `1px solid ${active ? '#0A0A0A' : '#CFCFCE'}`,
                  }}
                >
                  <span>{sz}</span>
                  {isCustom && active && <X className="h-3 w-3 opacity-80" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1">
            <input
              type="text"
              value={customSizeInput}
              onChange={(e) => setCustomSizeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomSize();
                }
              }}
              placeholder="Custom size (e.g. 32, 34, Free Size)"
              className="admin-inp !w-auto min-w-[210px] flex-1 max-w-[300px]"
            />
            <button
              type="button"
              onClick={handleAddCustomSize}
              className="admin-btn admin-btn-sm !h-[38px]"
            >
              <Plus className="h-3.5 w-3.5" /> Add Size
            </button>
          </div>

          {errors.sizes && (
            <span className="text-[12px] text-[#B91C1C] font-medium">{errors.sizes}</span>
          )}
        </div>

        {/* 3. Product Color (Available Colors) */}
        <div className="admin-fld">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="admin-lbl">
              Available Colors <span className="text-[#B91C1C]">*</span>
            </label>
            <span className="admin-sub">
              Quick-select presets or pick any custom color
            </span>
          </div>

          {/* Preset Quick Swatches */}
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((preset) => {
              const active = selectedColors.some(
                (c) => c.name.toLowerCase() === preset.name.toLowerCase()
              );
              return (
                <button
                  key={preset.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePresetColor(preset)}
                  className="h-9 px-3.5 rounded-full text-[12px] font-medium cursor-pointer inline-flex items-center gap-2 transition-colors"
                  style={{
                    backgroundColor: active ? '#0A0A0A' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#0A0A0A',
                    border: `1px solid ${active ? '#0A0A0A' : '#CFCFCE'}`,
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Color Picker + Name Input */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <label
              htmlFor="upload-color-picker"
              className="h-[38px] px-2.5 rounded-[8px] border border-[#D4D4D3] bg-white inline-flex items-center gap-2 cursor-pointer"
              title="Choose color swatch"
            >
              <input
                id="upload-color-picker"
                type="color"
                value={customColorHex}
                onChange={(e) => setCustomColorHex(e.target.value)}
                className="w-6 h-6 border-0 p-0 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-[#6A6A6A] uppercase">
                {customColorHex}
              </span>
            </label>
            <input
              type="text"
              value={customColorName}
              onChange={(e) => {
                setCustomColorName(e.target.value);
                if (errors.colors) setErrors((prev) => ({ ...prev, colors: undefined }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomColor();
                }
              }}
              placeholder="Color name (e.g. Graphite, Olive, Burgundy)"
              className="admin-inp !w-auto min-w-[200px] flex-1 max-w-[300px]"
            />
            <button
              type="button"
              onClick={handleAddCustomColor}
              className="admin-btn admin-btn-sm !h-[38px]"
            >
              <Plus className="h-3.5 w-3.5" /> Add Color
            </button>
          </div>

          {/* Selected Color Tags */}
          {selectedColors.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedColors.map((color) => (
                <span
                  key={color.name}
                  className="inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-[8px] bg-[#F1F1F0] border border-[#D4D4D3] text-[12px] font-medium text-[#0A0A0A]"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span>{color.name}</span>
                  <button
                    type="button"
                    onClick={() => removeColor(color.name)}
                    aria-label={`Remove color ${color.name}`}
                    className="w-5 h-5 rounded hover:bg-[#E2E2E1] inline-flex items-center justify-center text-[#6A6A6A] hover:text-[#0A0A0A] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {errors.colors && (
            <span className="text-[12px] text-[#B91C1C] font-medium">{errors.colors}</span>
          )}
        </div>

        {/* 4. Short Description */}
        <div className="admin-fld">
          <label className="admin-lbl" htmlFor="upload-prod-shortdesc">
            Short Description (Optional)
          </label>
          <input
            id="upload-prod-shortdesc"
            type="text"
            value={shortDescription}
            onChange={(e) => {
              setShortDescription(e.target.value);
              setSuccessBanner(null);
            }}
            placeholder="Concise one-line summary shown near product price & cards"
            className="admin-inp h-[42px] text-[13.5px]"
          />
        </div>

        {/* 5. Product Description */}
        <div className="admin-fld">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="admin-lbl" htmlFor="upload-prod-desc">
              Product Description <span className="text-[#B91C1C]">*</span>
            </label>
            <button
              type="button"
              disabled={isGeneratingCopy}
              onClick={() => void handleGenerateCopy()}
              className="admin-btn admin-btn-sm"
            >
              {isGeneratingCopy ? 'Drafting...' : 'Draft Copy'}
            </button>
          </div>
          <textarea
            id="upload-prod-desc"
            required
            rows={6}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setSuccessBanner(null);
              if (errors.description)
                setErrors((prev) => ({ ...prev, description: undefined }));
            }}
            placeholder="Write a detailed product description. Line breaks and paragraphs are preserved on the storefront..."
            className={`admin-inp !min-h-[150px] text-[13.5px] leading-relaxed ${
              errors.description ? '!border-[#B91C1C]' : ''
            }`}
          />
          <div className="flex justify-between items-center text-[11px] text-[#6A6A6A]">
            <span>Line breaks and bullet spacing are preserved.</span>
            <span className="tabular-nums">{description.length} characters</span>
          </div>
          {errors.description && (
            <span className="text-[12px] text-[#B91C1C] font-medium">
              {errors.description}
            </span>
          )}
        </div>
      </section>

      {/* ==================== SECTION 2: PRODUCT MEDIA ==================== */}
      <section className="admin-card p-5 sm:p-6 flex flex-col gap-6">
        <div className="border-b border-[#ECECEB] pb-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="admin-lbl">Section 02</span>
            <h3 className="text-[18px] mt-0.5">Product Media</h3>
          </div>
          <span className="admin-sub">
            Upload multiple high-resolution photos and an optional product video
          </span>
        </div>

        {/* 5. Product Images Uploader & Thumbnail Grid */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="admin-lbl">
              Product Images <span className="text-[#B91C1C]">*</span>
            </label>
            <span className="admin-sub">
              JPG, JPEG, PNG, WEBP · Max 10 MB each · {images.length} selected
            </span>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) appendImageFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => imageInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                imageInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setImageDropActive(true);
            }}
            onDragLeave={() => setImageDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setImageDropActive(false);
              if (e.dataTransfer.files) appendImageFiles(e.dataTransfer.files);
            }}
            className={`rounded-[12px] border-2 border-dashed p-6 sm:p-7 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
              imageDropActive
                ? 'border-[#0A0A0A] bg-[#F1F1F0]'
                : errors.images
                ? 'border-[#B91C1C] bg-[#FEF2F2]/40'
                : 'border-[#CFCFCE] bg-[#FAFAFA] hover:border-[#0A0A0A]'
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-white border border-[#D4D4D3] flex items-center justify-center text-[#0A0A0A]">
              <ImagePlus className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-[#0A0A0A]">
                Drag &amp; drop product images here, or browse files
              </span>
              <span className="text-[12px] text-[#6A6A6A]">
                Select multiple images at once. The primary image appears as the main product photo.
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                imageInputRef.current?.click();
              }}
              className="admin-btn admin-btn-dark admin-btn-sm mt-1"
            >
              <Upload className="h-3.5 w-3.5" /> Select Images
            </button>
          </div>

          {errors.images && (
            <span className="text-[12px] text-[#B91C1C] font-medium">{errors.images}</span>
          )}

          {/* Uploaded / Selected Image Previews Grid */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-1">
              {images.map((img, idx) => {
                const isPrimary =
                  primaryImageId === img.id || (!primaryImageId && idx === 0);
                return (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => setDraggedImageId(img.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedImageId) reorderImageById(draggedImageId, img.id);
                      setDraggedImageId(null);
                    }}
                    onDragEnd={() => setDraggedImageId(null)}
                    className={`rounded-[11px] border bg-white overflow-hidden flex flex-col transition-shadow ${
                      isPrimary
                        ? 'border-[#0A0A0A] ring-1 ring-[#0A0A0A]'
                        : 'border-[#D4D4D3]'
                    }`}
                  >
                    <div className="relative aspect-[4/5] bg-[#EFEFEE]">
                      <img
                        src={img.url}
                        alt={`Image ${idx + 1}: ${img.name}`}
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-[6px] bg-white/95 border border-[#D4D4D3] text-[10px] font-semibold text-[#0A0A0A]">
                          Image {idx + 1}
                        </span>
                        {isPrimary && (
                          <span className="px-2 py-0.5 rounded-[6px] bg-[#0A0A0A] text-white text-[10px] font-semibold tracking-wider uppercase">
                            PRIMARY
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => removeImage(img.id)}
                        aria-label={`Remove ${img.name}`}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 border border-[#D4D4D3] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white inline-flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Upload progress overlay */}
                      {img.status === 'uploading' && (
                        <div className="absolute inset-x-0 bottom-0 bg-[#0A0A0A]/85 text-white px-2.5 py-2 flex flex-col gap-1">
                          <div className="flex justify-between text-[11px] font-medium">
                            <span>Uploading...</span>
                            <span className="tabular-nums">{img.progress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/25 overflow-hidden">
                            <div
                              className="h-full bg-white transition-all duration-150"
                              style={{ width: `${img.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex flex-col gap-2 border-t border-[#ECECEB]">
                      <div className="flex items-center justify-between gap-1 text-[11px] text-[#6A6A6A]">
                        <span className="truncate font-medium text-[#0A0A0A]">
                          {img.name}
                        </span>
                        {img.sizeBytes ? (
                          <span className="shrink-0 tabular-nums">
                            {formatBytes(img.sizeBytes)}
                          </span>
                        ) : null}
                      </div>

                      {img.error && (
                        <span className="text-[11px] text-[#B91C1C] leading-snug">
                          {img.error}
                        </span>
                      )}

                      <div className="flex items-center justify-between gap-1">
                        {isPrimary ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0A0A0A]">
                            <Star className="h-3 w-3 fill-[#0A0A0A]" /> Main Photo
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setAsPrimaryImage(img.id)}
                            className="text-[11px] font-semibold text-[#0A0A0A] underline underline-offset-2 hover:opacity-70 cursor-pointer"
                          >
                            Set Primary
                          </button>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0 || isSubmitting}
                            onClick={() => moveImage(idx, -1)}
                            aria-label="Move image left"
                            className="w-6 h-6 rounded border border-[#D4D4D3] bg-white inline-flex items-center justify-center disabled:opacity-35 cursor-pointer"
                          >
                            <ArrowLeft className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === images.length - 1 || isSubmitting}
                            onClick={() => moveImage(idx, 1)}
                            aria-label="Move image right"
                            className="w-6 h-6 rounded border border-[#D4D4D3] bg-white inline-flex items-center justify-center disabled:opacity-35 cursor-pointer"
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. Product Video Upload Section */}
        <div className="border-t border-[#ECECEB] pt-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="admin-lbl">Product Video (Optional)</label>
            <span className="admin-sub">MP4, WEBM, MOV · Max 50 MB</span>
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            className="hidden"
            onChange={(e) => {
              handleSelectVideoFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {!video ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => videoInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  videoInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setVideoDropActive(true);
              }}
              onDragLeave={() => setVideoDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setVideoDropActive(false);
                handleSelectVideoFile(e.dataTransfer.files?.[0]);
              }}
              className={`rounded-[12px] border-2 border-dashed p-5 text-center transition-colors cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 ${
                videoDropActive
                  ? 'border-[#0A0A0A] bg-[#F1F1F0]'
                  : errors.video
                  ? 'border-[#B91C1C] bg-[#FEF2F2]/40'
                  : 'border-[#CFCFCE] bg-[#FAFAFA] hover:border-[#0A0A0A]'
              }`}
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-white border border-[#D4D4D3] flex items-center justify-center text-[#0A0A0A] shrink-0">
                  <Film className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold text-[#0A0A0A]">
                    Add a product runway / fit video
                  </span>
                  <span className="text-[12px] text-[#6A6A6A]">
                    Drag &amp; drop MP4, WEBM, or MOV here or select from your device
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  videoInputRef.current?.click();
                }}
                className="admin-btn admin-btn-sm shrink-0"
              >
                <Upload className="h-3.5 w-3.5" /> Select Video
              </button>
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#D4D4D3] bg-[#FAFAFA] p-4 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-4 items-center">
                <video
                  src={video.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-[210px] rounded-[9px] bg-[#0A0A0A] object-contain border border-[#D4D4D3]"
                />
                <div className="flex flex-col gap-2.5 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="admin-lbl">Selected Video</span>
                    <span className="text-[14px] font-semibold text-[#0A0A0A] truncate">
                      {video.name}
                    </span>
                    <span className="admin-sub">
                      {video.sizeBytes ? formatBytes(video.sizeBytes) : 'Ready on server'} ·{' '}
                      {video.status === 'uploaded'
                        ? 'Uploaded'
                        : video.status === 'uploading'
                        ? `Uploading ${video.progress}%`
                        : 'Pending upload'}
                    </span>
                  </div>

                  {video.status === 'uploading' && (
                    <div className="flex flex-col gap-1 max-w-sm">
                      <div className="h-2 rounded-full bg-[#E2E2E1] overflow-hidden">
                        <div
                          className="h-full bg-[#0A0A0A] transition-all duration-150"
                          style={{ width: `${video.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {video.error && (
                    <span className="text-[12px] text-[#B91C1C] font-medium">
                      {video.error}
                    </span>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => videoInputRef.current?.click()}
                      className="admin-btn admin-btn-sm"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Replace Video
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleRemoveVideo}
                      className="admin-btn admin-btn-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove Video
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errors.video && (
            <span className="text-[12px] text-[#B91C1C] font-medium">{errors.video}</span>
          )}
        </div>
      </section>

      {/* ==================== SECTION 3: PRICING, CATEGORY, STATUS & TAGS ==================== */}
      <section className="admin-card p-5 sm:p-6 flex flex-col gap-5">
        <div className="border-b border-[#ECECEB] pb-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="admin-lbl">Section 03</span>
            <h3 className="text-[18px] mt-0.5">Pricing, Category, Tags &amp; Visibility</h3>
          </div>
          <span className="admin-sub">SKU, pricing, category/subcategory, stock &amp; publish status</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-sku">
              Product SKU / ID <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              id="upload-prod-sku"
              className={`admin-inp uppercase ${errors.sku ? '!border-[#B91C1C]' : ''}`}
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                if (errors.sku) setErrors((prev) => ({ ...prev, sku: undefined }));
              }}
              placeholder="PW-MN-101"
            />
            {errors.sku && (
              <span className="text-[12px] text-[#B91C1C] font-medium">{errors.sku}</span>
            )}
          </div>

          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-price">
              Product Price / Regular (৳) <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              id="upload-prod-price"
              type="number"
              min="1"
              className={`admin-inp ${errors.price ? '!border-[#B91C1C]' : ''}`}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                if (errors.price) setErrors((prev) => ({ ...prev, price: undefined }));
              }}
              placeholder="1490"
            />
            {errors.price && (
              <span className="text-[12px] text-[#B91C1C] font-medium">{errors.price}</span>
            )}
          </div>

          <div className="admin-fld">
            <div className="flex items-center justify-between gap-2">
              <label className="admin-lbl" htmlFor="upload-prod-saleprice">
                Discount / Sale Price (৳)
              </label>
              {salePrice.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setSalePrice('');
                    setIsSale(false);
                    setErrors((prev) => ({ ...prev, salePrice: undefined }));
                  }}
                  className="text-[11px] font-semibold text-[#0A0A0A] underline cursor-pointer"
                >
                  Remove Discount
                </button>
              )}
            </div>
            <input
              id="upload-prod-saleprice"
              type="number"
              min="0"
              className={`admin-inp ${errors.salePrice ? '!border-[#B91C1C]' : ''}`}
              value={salePrice}
              onChange={(e) => {
                setSalePrice(e.target.value);
                if (errors.salePrice)
                  setErrors((prev) => ({ ...prev, salePrice: undefined }));
              }}
              placeholder="Optional lower sale price"
            />
            {discountPreviewPct > 0 && (
              <span className="text-[11px] font-medium text-[#0A0A0A]">
                Active discount: {discountPreviewPct}% OFF (Customers pay ৳{numericSalePreview.toLocaleString('en-US')})
              </span>
            )}
            {errors.salePrice && (
              <span className="text-[12px] text-[#B91C1C] font-medium">
                {errors.salePrice}
              </span>
            )}
          </div>

          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-stock">
              Available Quantity / Stock <span className="text-[#B91C1C]">*</span>
            </label>
            <input
              id="upload-prod-stock"
              type="number"
              min="0"
              className={`admin-inp ${errors.inventory ? '!border-[#B91C1C]' : ''}`}
              value={inventory}
              onChange={(e) => {
                setInventory(e.target.value);
                if (errors.inventory)
                  setErrors((prev) => ({ ...prev, inventory: undefined }));
              }}
              placeholder="40"
            />
            {errors.inventory && (
              <span className="text-[12px] text-[#B91C1C] font-medium">
                {errors.inventory}
              </span>
            )}
          </div>

          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-cat">
              Product Category <span className="text-[#B91C1C]">*</span>
            </label>
            <select
              id="upload-prod-cat"
              className={`admin-inp ${errors.category ? '!border-[#B91C1C]' : ''}`}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory('');
                if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
              }}
            >
              {categoryOptionNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && (
              <span className="text-[12px] text-[#B91C1C] font-medium">
                {errors.category}
              </span>
            )}
          </div>

          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-subcat">
              Subcategory (Optional)
            </label>
            <input
              id="upload-prod-subcat"
              list="pw-subcategory-suggestions"
              className="admin-inp"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="Pick or type subcategory"
            />
            <datalist id="pw-subcategory-suggestions">
              {subcategorySuggestions.map((sub) => (
                <option key={sub} value={sub} />
              ))}
            </datalist>
            {subcategorySuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {subcategorySuggestions.slice(0, 6).map((sub) => {
                  const active = subcategory.toLowerCase() === sub.toLowerCase();
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubcategory(active ? '' : sub)}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium cursor-pointer"
                      style={{
                        backgroundColor: active ? '#0A0A0A' : '#F4F4F3',
                        color: active ? '#FFFFFF' : '#2E2E2E',
                        border: `1px solid ${active ? '#0A0A0A' : '#D4D4D3'}`,
                      }}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-col">
              Collection
            </label>
            <select
              id="upload-prod-col"
              className="admin-inp"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            >
              {collections.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-fld sm:col-span-2">
            <label className="admin-lbl" htmlFor="upload-prod-tags">
              Product Tags
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="upload-prod-tags"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTagValue(tagInput);
                  }
                }}
                placeholder="Type tag & press Enter (e.g. Heavyweight, 260 GSM, Boxy)"
                className="admin-inp !w-auto min-w-[220px] flex-1"
              />
              <button
                type="button"
                onClick={() => addTagValue(tagInput)}
                className="admin-btn admin-btn-sm !h-[38px]"
              >
                <Plus className="h-3.5 w-3.5" /> Add Tag
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-[#F1F1F0] border border-[#D4D4D3] text-[11.5px] font-medium text-[#0A0A0A]"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTagValue(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="w-4 h-4 rounded-full hover:bg-[#E2E2E1] inline-flex items-center justify-center cursor-pointer"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-fab">
              Fabric / Material
            </label>
            <input
              id="upload-prod-fab"
              className="admin-inp"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              placeholder="100% combed cotton"
            />
          </div>
          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-care">
              Care Instructions
            </label>
            <input
              id="upload-prod-care"
              className="admin-inp"
              value={care}
              onChange={(e) => setCare(e.target.value)}
              placeholder="Cold wash inside out"
            />
          </div>
          <div className="admin-fld">
            <label className="admin-lbl" htmlFor="upload-prod-fit">
              Size &amp; Fit Note
            </label>
            <input
              id="upload-prod-fit"
              className="admin-inp"
              value={sizeFit}
              onChange={(e) => setSizeFit(e.target.value)}
              placeholder="Regular fit, model wears M"
            />
          </div>
        </div>

        {/* Product Status Control */}
        <div className="admin-fld border-t border-[#ECECEB] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="admin-lbl">
              Product Status <span className="text-[#B91C1C]">*</span>
            </span>
            <span className="admin-sub">
              {PRODUCT_STATUS_OPTIONS.find((o) => o.value === status)?.hint}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PRODUCT_STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatus(opt.value)}
                  className="px-3.5 py-2.5 rounded-[10px] text-left cursor-pointer transition-colors"
                  style={{
                    backgroundColor: active ? '#0A0A0A' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#0A0A0A',
                    border: `1px solid ${active ? '#0A0A0A' : '#D4D4D3'}`,
                  }}
                >
                  <div className="text-[12.5px] font-semibold">{opt.label}</div>
                  <div
                    className="text-[10.5px] mt-0.5 leading-snug"
                    style={{ color: active ? '#D4D4D3' : '#6A6A6A' }}
                  >
                    {opt.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-fld">
          <span className="admin-lbl">Storefront Merchandising Badges</span>
          <div className="flex flex-wrap gap-2">
            {badgeToggleItems.map((b) => (
              <button
                key={b.label}
                type="button"
                aria-pressed={b.on}
                onClick={b.toggle}
                className="h-8 px-[13px] rounded-full text-[12px] font-medium cursor-pointer"
                style={{
                  backgroundColor: b.on ? '#0A0A0A' : '#FFFFFF',
                  color: b.on ? '#FFFFFF' : '#0A0A0A',
                  border: `1px solid ${b.on ? '#0A0A0A' : '#CFCFCE'}`,
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Progress Bar + Primary Submit Actions */}
        <div className="border-t border-[#ECECEB] pt-5 flex flex-col gap-3.5">
          {isSubmitting && (
            <div className="rounded-[10px] border border-[#D4D4D3] bg-[#F7F7F6] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-[#0A0A0A]">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {submitStatusText || 'Saving product...'}
                </span>
                <span className="tabular-nums font-semibold">{submitProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#E2E2E1] overflow-hidden">
                <div
                  className="h-full bg-[#0A0A0A] transition-all duration-150"
                  style={{ width: `${submitProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="admin-sub">
              {images.length} image{images.length === 1 ? '' : 's'}
              {video ? ' · 1 video' : ''} · {selectedSizes.length} size
              {selectedSizes.length === 1 ? '' : 's'} · {selectedColors.length} color
              {selectedColors.length === 1 ? '' : 's'} · Status: {status}
            </span>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {editingProduct && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onCancelEdit}
                  className="admin-btn !h-[46px] flex-1 sm:flex-initial"
                >
                  Cancel
                </button>
              )}
              {!editingProduct && status === 'Published' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void submitWithStatus('Draft')}
                  className="admin-btn !h-[46px] flex-1 sm:flex-initial"
                >
                  Save as Draft
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="admin-btn admin-btn-dark !h-[46px] !px-7 text-[13.5px] flex-1 sm:flex-initial"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : editingProduct ? (
                  `Update Product (${status})`
                ) : status === 'Published' ? (
                  'Publish Product'
                ) : (
                  `Save as ${status}`
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </form>
  );
};
