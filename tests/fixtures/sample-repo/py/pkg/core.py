from .helpers import helper
from . import models as m
import pkg.models


def run(path):
    return helper(m.Model(path))
