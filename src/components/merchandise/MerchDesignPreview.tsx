import { MerchProductMockup } from "./MerchProductMockup";

type DesignElement = {
  id?: string;
  type: "image" | "text";
  src?: string;
  text?: string;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  color?: string;
  fontSize?: number;
};

type DesignData = {
  productType?: string;
  garmentColor?: string;
  frontElements?: DesignElement[];
  backElements?: DesignElement[];
  areaElements?: Record<string, DesignElement[]>;
};

interface MerchDesignPreviewProps {
  design: any;
  className?: string;
}

const shapeForProduct = (itemType: string) => {
  const name = itemType.toLowerCase();
  if (name.includes("poster") || name.includes("print") || name.includes("setlist") || name.includes("programme")) return "poster";
  if (name.includes("sticker") || name.includes("patch") || name.includes("badge")) return "flat";
  if (name.includes("tote")) return "tote";
  if (name.includes("bottle")) return "bottle";
  if (name.includes("pint") || name.includes("glass")) return "glass";
  if (name.includes("mug")) return "mug";
  if (name.includes("football") || name.includes("jersey")) return "football";
  if (name.includes("hoodie")) return "hoodie";
  if (name.includes("crewneck") || name.includes("sweatshirt")) return "crewneck";
  if (name.includes("long sleeve")) return "long";
  if (name.includes("cap") || name.includes("beanie")) return "cap";
  return "tee";
};

export const MerchDesignPreview = ({ design, className = "" }: MerchDesignPreviewProps) => {
  const data = (design?.design_data ?? {}) as DesignData;
  const productType = data.productType ?? design?.product_type ?? design?.item_type ?? "Graphic Tee";
  const color = data.garmentColor ?? design?.background_color ?? design?.garment_color ?? "#171717";
  const areaMap = data.areaElements && typeof data.areaElements === "object"
    ? data.areaElements
    : { front: data.frontElements ?? [], back: data.backElements ?? [] };
  const area = Object.keys(areaMap).find((key) => (areaMap[key] ?? []).length) ?? "front";
  let elements = areaMap[area] ?? [];

  if (!elements.length && design?.artwork_url) {
    elements = [{ type: "image", src: design.artwork_url, x: 50, y: 48, scale: 1, rotation: 0 }];
  }

  if (!elements.length && design?.preview_image_url) {
    return <img src={design.preview_image_url} alt={design.design_name ?? "Merch design"} className={`h-full w-full object-contain ${className}`} />;
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-b from-muted/20 to-muted ${className}`}>
      <MerchProductMockup shape={shapeForProduct(productType)} color={color} area={area} />
      {elements.map((element, index) => (
        <div
          key={element.id ?? `${element.type}-${index}`}
          className="pointer-events-none absolute"
          style={{
            left: `${element.x ?? 50}%`,
            top: `${element.y ?? 50}%`,
            transform: `translate(-50%, -50%) scale(${element.scale ?? 1}) rotate(${element.rotation ?? 0}deg)`,
            transformOrigin: "center",
          }}
        >
          {element.type === "image" && element.src ? (
            <img src={element.src} alt="Design artwork" className="max-h-32 max-w-32 object-contain drop-shadow-md sm:max-h-40 sm:max-w-40" />
          ) : (
            <div
              className="whitespace-nowrap px-2 py-1 text-center font-black uppercase tracking-wide drop-shadow"
              style={{ color: element.color ?? "#fff", fontSize: Math.max(10, Math.min(72, element.fontSize ?? 24)) }}
            >
              {element.text ?? ""}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};