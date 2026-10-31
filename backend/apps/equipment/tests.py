from django.test import TestCase

from .models import Equipment


class NodeIdValidationTests(TestCase):
    """Имя узла идёт в темы MQTT и имена каналов — MAC с двоеточиями нельзя."""

    def make(self, node_id):
        from apps.methods.models import WeldingMethod

        method = WeldingMethod.objects.get_or_create(id="tig-n", defaults={"name": "РИН", "process": "tig"})[0]
        return Equipment(name=f"Аппарат {node_id}", method=method, node_id=node_id)

    def test_good_names(self):
        for name in ("node-01", "post.3", "WT32-A1"):
            self.make(name).full_clean()

    def test_bad_names(self):
        from django.core.exceptions import ValidationError

        for name in ("A0:B7:65:12:34:56", "node 01", "пост-1", "weld/1", "node+", "-node"):
            with self.assertRaises(ValidationError, msg=name):
                self.make(name).full_clean()
