import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type SupportedLanguage } from "@/i18n";
import { useLanguageStore, useTranslation } from "@/hooks/useTranslation";

const languages: Array<{ code: SupportedLanguage; name: string; flag: string }> = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '简体中文', flag: '🇨🇳' },
  { code: 'pt', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t('nav.selectLanguage', 'Select language')}
        >
          <Languages className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={8}
        className="z-[80] max-h-[60vh] w-[min(16rem,calc(100vw-1.5rem))] overflow-y-auto"
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? 'bg-accent' : ''}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true">{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
