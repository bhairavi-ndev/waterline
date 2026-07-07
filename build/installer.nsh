; -----------------------------------------------------------------------------
; Waterline — custom NSIS installer additions
;   • Adds a "Shortcuts" page (Desktop / Start Menu checkboxes) right after the
;     install-location page.
;   • Creates only the shortcuts the user ticks.
;   • Removes them on uninstall.
; The install-location page itself is provided by
; allowToChangeInstallationDirectory in electron-builder.yml.
;
; electron-builder prepends this file to BOTH the installer and uninstaller
; compile passes, so installer-only code (the custom page Functions) must be
; guarded with !ifndef BUILD_UNINSTALLER — otherwise those Functions are
; unreferenced in the uninstaller pass and NSIS (warnings-as-errors) fails.
; -----------------------------------------------------------------------------

!ifndef BUILD_UNINSTALLER
  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"

  Var ShortcutDialog
  Var DesktopCheckbox
  Var StartMenuCheckbox
  Var MakeDesktopShortcut
  Var MakeStartMenuShortcut

  ; Default to creating both (covers silent installs, which skip the page).
  !macro customInit
    StrCpy $MakeDesktopShortcut 1
    StrCpy $MakeStartMenuShortcut 1
  !macroend

  ; Inserted by electron-builder between the directory page and the install step.
  !macro customPageAfterChangeDir
    Page custom waterlineShortcutsPage waterlineShortcutsLeave
  !macroend

  Function waterlineShortcutsPage
    nsDialogs::Create 1018
    Pop $ShortcutDialog
    ${If} $ShortcutDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "Choose which shortcuts Waterline should create."
    Pop $0

    ${NSD_CreateCheckbox} 0 34u 100% 12u "Create a shortcut on the &Desktop"
    Pop $DesktopCheckbox
    ${If} $MakeDesktopShortcut == 1
      ${NSD_Check} $DesktopCheckbox
    ${EndIf}

    ${NSD_CreateCheckbox} 0 52u 100% 12u "Create a shortcut in the &Start Menu"
    Pop $StartMenuCheckbox
    ${If} $MakeStartMenuShortcut == 1
      ${NSD_Check} $StartMenuCheckbox
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function waterlineShortcutsLeave
    ${NSD_GetState} $DesktopCheckbox $MakeDesktopShortcut
    ${NSD_GetState} $StartMenuCheckbox $MakeStartMenuShortcut
  FunctionEnd

  ; $appExe, ${SHORTCUT_NAME} and ${APP_DESCRIPTION} are set by electron-builder
  ; before this macro runs inside the install section.
  !macro customInstall
    ${If} $MakeDesktopShortcut == 1
      CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ${EndIf}
    ${If} $MakeStartMenuShortcut == 1
      CreateShortCut "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ${EndIf}
  !macroend
!endif

; Runs in the uninstaller pass — clean up whatever we may have created.
!macro customUnInstall
  Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  Delete "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
!macroend
