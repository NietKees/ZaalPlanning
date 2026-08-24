export function minutesToTime(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const hh = hours.toString().padStart(2, "0");
    const mm = minutes.toString().padStart(2, "0");

    return `${hh}:${mm}`;
}

import Swal from "sweetalert2";

/**
 * Custom Alert Object using Tailwind v4 theme variables
 * Usage: alert.success('Title', 'Message')
 */
export const alert = {
    // Common shared styles to keep the object dry
    _baseConfig: {
        buttonsStyling: false,
        showCloseButton: true,
        closeButtonHtml: `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      `,
    },

    _customClasses: {
        container: "!bg-black/50 !p-4 !backdrop-blur",
        popup:
            "!rounded-lg !bg-neutral-100 !p-0 !overflow-hidden !shadow-2xl !max-w-2xl !w-full !flex !flex-col !border !border-foreground/10",
        header:
            "!bg-white !px-4 !py-2 !flex !items-center !justify-between !border-b-0", // Top bar
        closeButton:
            "!absolute !top-3 !right-4 !flex !items-center !justify-center !rounded-md !text-foreground/40 !hover:text-foreground !hover:outline-1 !m-0 !p-1 !h-auto !w-auto !border-0 !shadow-none !z-10",
        title:
            "flex!items-center !justify-between !bg-white !px-4 !py-2 !text-left",
        htmlContainer: "!p-6 !m-0 !text-left ",
        actions:
            "!p-4 !m-0 !justify-end !bg-foreground/[0.02] !border-t !border-foreground/5",
        confirmButton:
            "rounded-md px-6 py-2 text-sm font-medium text-white transition-all active:scale-95 hover:brightness-110 hover:cursor-pointer",
    },

    success(title: string, message: string) {
        return Swal.fire({
            ...this._baseConfig,
            title,
            html: message,
            customClass: {
                ...this._customClasses,
                confirmButton: `${this._customClasses.confirmButton} bg-primary`,
            },
        });
    },

    error(title: string, message: string) {
        return Swal.fire({
            ...this._baseConfig,
            title,
            html: message,
            customClass: {
                ...this._customClasses,
                confirmButton: `${this._customClasses.confirmButton} !bg-warning`,
            },
        });
    },

    warn(title: string, message: string) {
        return Swal.fire({
            ...this._baseConfig,
            title,
            html: message,
            customClass: {
                ...this._customClasses,
                confirmButton: `${this._customClasses.confirmButton} bg-secondary !text-foreground`,
            },
        });
    },

    confirm(title: string, message: string) {
        return Swal.fire({
            ...this._baseConfig,
            title,
            html: message,
            showCancelButton: true,
            confirmButtonText: "Bevestigen",
            cancelButtonText: "Annuleren",
            customClass: {
                ...this._customClasses,
                confirmButton: `${this._customClasses.confirmButton} bg-primary`,
                cancelButton:
                    "rounded-md px-6 py-2 text-sm font-medium bg-foreground/10 hover:bg-foreground/20 transition-all hover:cursor-pointer",
            },
        }).then((result) => result.isConfirmed);
    }
};
