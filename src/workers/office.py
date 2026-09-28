# "Python w pracy" office tools: a fresh folder of files for every run and a
# fake mail server. The student's code uses the real modules (os, shutil,
# pathlib, email, smtplib) — only smtplib is swapped, so nothing leaves the
# browser; sent mail lands in _outbox for the "📤 Wysłane" panel.
#
# Prepended by the worker (and by scripts/check_levels.py):
#   _SETUP_JSON = '<files, env and expectations of the current level>'
#   _WORKDIR = '<folder the level works in>'
import shutil as _shutil
import sys as _sys
import types as _types

_setup = _json.loads(_SETUP_JSON)
_outbox = []


def _reset_workspace():
    _os.chdir(_os.path.dirname(_WORKDIR))
    if _os.path.isdir(_WORKDIR):
        _shutil.rmtree(_WORKDIR)
    _os.makedirs(_WORKDIR)
    for path, content in _setup["files"].items():
        full = _os.path.join(_WORKDIR, path)
        _os.makedirs(_os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)
    _os.chdir(_WORKDIR)


if "files" in _setup:
    _reset_workspace()
_os.environ.pop("SMTP_HASLO", None)  # a previous level's password must not leak in
for _k, _v in _setup.get("env", {}).items():
    _os.environ[_k] = _v


class _SMTPAuthenticationError(Exception):
    pass


class _SMTP:
    def __init__(self, host="", port=0, *args, **kwargs):
        self.host = host

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def ehlo(self, *args):
        pass

    def starttls(self, *args, **kwargs):
        pass

    def login(self, user, password):
        wanted = _os.environ.get("SMTP_HASLO")
        if wanted is not None and password != wanted:
            raise _SMTPAuthenticationError(535, "Serwer poczty odrzucił login lub hasło")

    def send_message(self, msg, *args, **kwargs):
        _outbox.append(msg)

    def sendmail(self, from_addr, to_addrs, text):
        import email
        msg = email.message_from_string(text)
        if "To" not in msg:
            msg["To"] = ", ".join(to_addrs) if isinstance(to_addrs, list) else to_addrs
        _outbox.append(msg)

    def quit(self):
        pass


_smtplib = _types.ModuleType("smtplib")
_smtplib.SMTP = _SMTP
_smtplib.SMTP_SSL = _SMTP
_smtplib.SMTPAuthenticationError = _SMTPAuthenticationError
_sys.modules["smtplib"] = _smtplib


def _mail_line(msg):
    line = f"{msg['To']} | {msg['Subject']}"
    names = [p.get_filename() for p in msg.iter_attachments()] if hasattr(msg, "iter_attachments") else []
    if names:
        line += " | 📎 " + ", ".join(names)
    return line


def _workspace_files():
    if "files" not in _setup:
        return None
    found = []
    for root, _dirs, files in _os.walk(_WORKDIR):
        for f in files:
            found.append(_os.path.relpath(_os.path.join(root, f), _WORKDIR).replace("\\", "/"))
    return sorted(found)


def _verify():
    """What the level expects about files and mail, as plain-Polish problems."""
    problems = []
    expected = _setup.get("expectedFiles")
    if expected is not None and _workspace_files() != sorted(expected):
        problems.append("Folder wygląda inaczej, niż powinien. Powinno w nim być:\n- " + "\n- ".join(sorted(expected)))
    for path, content in _setup.get("expectedFileContents", {}).items():
        full = _os.path.join(_WORKDIR, path)
        if not _os.path.isfile(full):
            problems.append(f"Brakuje pliku {path}.")
        else:
            with open(full, encoding="utf-8") as f:
                if f.read().strip() != content.strip():
                    problems.append(f"Plik {path} ma inną treść, niż powinien:\n{content.strip()}")
    outbox = _setup.get("expectedOutbox")
    if outbox is not None and [_mail_line(m) for m in _outbox] != outbox:
        problems.append("Wysłane maile nie zgadzają się z zadaniem. Powinno być:\n- " + ("\n- ".join(outbox) or "(żadnego maila)"))
    return problems
